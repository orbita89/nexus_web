// Ход длинной операции бэкенда потоком text/event-stream: публикация правки
// (PATCH …/entities/{id}/stream) и перестройка поиска (POST …/search/reindex/stream).
// Обе шлют JobEvent: plan → step/progress → done. EventSource не умеет PATCH и Authorization,
// поэтому поток читается из fetch (response.body) и разбирается здесь — без Svelte.
import type {
	SchemaDoneEvent,
	SchemaJobEvent,
	SchemaStep,
	SchemaStepStatus
} from '#lib/api/generated/catalog.ts';

/** Событие SSE: блок строк до пустой строки; data — склейка строк `data:` через \n. */
export async function* readEvents(
	body: ReadableStream<Uint8Array>
): AsyncGenerator<SchemaJobEvent> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	try {
		for (;;) {
			const { value, done } = await reader.read();
			// stream: true — русская буква, разрезанная между кусками, не превратится в «�».
			buffer += decoder.decode(value, { stream: !done });
			// Разделитель событий — пустая строка; \r\n тоже допустим по спецификации.
			const blocks = buffer.split(/\r?\n\r?\n/);
			buffer = done ? '' : blocks.pop()!;
			for (const block of blocks) {
				const data = block
					.split(/\r?\n/)
					.filter((line) => line.startsWith('data:'))
					.map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
					.join('\n');
				if (data) yield JSON.parse(data) as SchemaJobEvent;
			}
			if (done) return;
		}
	} finally {
		// Дочитали до done или вызывающий бросил поток — соединение больше не нужно.
		await reader.cancel().catch(() => {});
	}
}

export type StepState = {
	step: SchemaStep;
	title: string;
	/** pending — ещё не начался. */
	status: SchemaStepStatus | 'pending';
	message: string | null;
	durationMs: number | null;
	progress: { done: number; total: number } | null;
};

export type JobState = {
	steps: StepState[];
	done: SchemaDoneEvent | null;
};

export const emptyJob = (): JobState => ({ steps: [], done: null });

/** Следующее состояние лога по событию. Шаг не из плана добавляется в конец. */
export function applyEvent(state: JobState, event: SchemaJobEvent): JobState {
	switch (event.type) {
		case 'plan':
			return {
				...state,
				steps: event.steps.map(({ step, title }) => ({
					step,
					title,
					status: 'pending',
					message: null,
					durationMs: null,
					progress: null
				}))
			};
		case 'step':
			return update(state, event.step, (s) => ({
				...s,
				status: event.status,
				message: event.message,
				durationMs: event.duration_ms ?? s.durationMs
			}));
		case 'progress':
			return update(state, event.step, (s) => ({
				...s,
				status: s.status === 'pending' ? 'running' : s.status,
				progress: { done: event.done, total: event.total }
			}));
		case 'done':
			return { ...state, done: event };
	}
}

function update(state: JobState, step: SchemaStep, change: (s: StepState) => StepState): JobState {
	const known = state.steps.some((s) => s.step === step);
	const steps = known
		? state.steps
		: [
				...state.steps,
				{
					step,
					title: step,
					status: 'pending',
					message: null,
					durationMs: null,
					progress: null
				} as const
			];
	return { ...state, steps: steps.map((s) => (s.step === step ? change(s) : s)) };
}

/**
 * Пересборка статики пропущена: у бэкенда нет ISR_URL/ISR_SECRET. В разработке так и должно
 * быть — страницы сайта рендерятся на каждый запрос; в проде это значит, что статические
 * страницы не обновятся, и админу надо это увидеть. null — к шагу это не относится.
 */
export function skippedIsr(s: StepState, dev: boolean): { message: string; warn: boolean } | null {
	if (s.step !== 'isr' || s.status !== 'skipped') return null;
	return dev
		? {
				message: 'Не нужна в режиме разработки: страницы сайта рендерятся на каждый запрос',
				warn: false
			}
		: {
				message: `${s.message ?? 'Пропущена'} — статические страницы сайта не обновятся`,
				warn: true
			};
}

/** Поток оборвался до done: итог неизвестен (запись на бэкенде доводится до конца сама). */
export class JobInterrupted extends Error {
	constructor() {
		super('Связь с сервером прервалась до конца операции. Обновите страницу, чтобы увидеть итог.');
	}
}

/**
 * Прочитать поток до done, сообщая каждое состояние лога. Возвращает итог;
 * оборвался раньше — JobInterrupted.
 */
export async function runJob(
	body: ReadableStream<Uint8Array>,
	onstate: (state: JobState) => void
): Promise<SchemaDoneEvent> {
	let state = emptyJob();
	for await (const event of readEvents(body)) {
		state = applyEvent(state, event);
		onstate(state);
		if (state.done) return state.done;
	}
	throw new JobInterrupted();
}
