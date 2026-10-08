import { describe, expect, it } from 'vitest';
import type { SchemaJobEvent } from '#lib/api/generated/catalog.ts';
import { JobInterrupted, applyEvent, emptyJob, readEvents, runJob, skippedIsr } from './job';

/** Поток из кусков текста — как приходит из сети, с разрывами где угодно. */
function stream(...chunks: string[]) {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
			controller.close();
		}
	});
}

const sse = (event: SchemaJobEvent) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

const plan: SchemaJobEvent = {
	type: 'plan',
	steps: [
		{ step: 'db', title: 'Сохранение в БД' },
		{ step: 'search', title: 'Обновление поиска' },
		{ step: 'isr', title: 'Пересборка статики' }
	]
};

async function collect(body: ReadableStream<Uint8Array>) {
	const events = [];
	for await (const event of readEvents(body)) events.push(event);
	return events;
}

describe('readEvents', () => {
	it('события, разрезанные посередине, и несколько в одном куске', async () => {
		const text = sse(plan) + sse({ type: 'done', ok: true });
		const cut = [text.slice(0, 7), text.slice(7, 60), text.slice(60)];
		expect(await collect(stream(...cut))).toEqual([plan, { type: 'done', ok: true }]);
	});

	it('русская буква, разрезанная между кусками байтов', async () => {
		const bytes = new TextEncoder().encode(
			sse({ type: 'step', step: 'db', status: 'done', message: 'БД обновлена' })
		);
		const middle = bytes.indexOf(0xd0) + 1; // внутри двухбайтовой «Б»
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes.slice(0, middle));
				controller.enqueue(bytes.slice(middle));
				controller.close();
			}
		});
		expect(await collect(body)).toMatchObject([{ message: 'БД обновлена' }]);
	});

	it('\\r\\n, комментарии и данные без пробела после двоеточия', async () => {
		const text = `: ping\r\n\r\nevent: done\r\ndata:{"type":"done","ok":false}\r\n\r\n`;
		expect(await collect(stream(text))).toEqual([{ type: 'done', ok: false }]);
	});
});

describe('applyEvent', () => {
	it('план — все шаги ожидают; шаг и прогресс обновляют свой', () => {
		let state = applyEvent(emptyJob(), plan);
		expect(state.steps.map((s) => s.status)).toEqual(['pending', 'pending', 'pending']);

		state = applyEvent(state, {
			type: 'step',
			step: 'db',
			status: 'done',
			message: 'БД обновлена',
			duration_ms: 4
		});
		state = applyEvent(state, { type: 'progress', step: 'search', done: 500, total: 1000 });
		expect(state.steps[0]).toMatchObject({
			status: 'done',
			message: 'БД обновлена',
			durationMs: 4
		});
		expect(state.steps[1]).toMatchObject({
			status: 'running',
			progress: { done: 500, total: 1000 }
		});
		expect(state.steps[2].status).toBe('pending');
	});

	it('шаг не из плана — в конец лога', () => {
		const state = applyEvent(emptyJob(), {
			type: 'step',
			step: 'swap',
			status: 'running',
			message: 'Переключение'
		});
		expect(state.steps).toMatchObject([
			{ step: 'swap', status: 'running', message: 'Переключение' }
		]);
	});
});

describe('runJob', () => {
	it('итог — событие done, состояния — по одному на событие', async () => {
		const states: number[] = [];
		const done = await runJob(stream(sse(plan), sse({ type: 'done', ok: true })), (s) =>
			states.push(s.steps.length)
		);
		expect(done).toEqual({ type: 'done', ok: true });
		expect(states).toEqual([3, 3]);
	});

	it('поток оборвался до done — JobInterrupted', async () => {
		await expect(runJob(stream(sse(plan)), () => {})).rejects.toBeInstanceOf(JobInterrupted);
	});
});

describe('skippedIsr', () => {
	const isr = applyEvent(applyEvent(emptyJob(), plan), {
		type: 'step',
		step: 'isr',
		status: 'skipped',
		message: 'ISR не настроен (ISR_URL, ISR_SECRET)'
	}).steps[2];

	it('в разработке — спокойное пояснение, в проде — предупреждение', () => {
		expect(skippedIsr(isr, true)).toMatchObject({ warn: false, message: /режиме разработки/ });
		expect(skippedIsr(isr, false)).toMatchObject({ warn: true, message: /не обновятся/ });
	});

	it('прочие шаги и выполненный ISR не трогает', () => {
		expect(skippedIsr({ ...isr, status: 'done' }, false)).toBeNull();
		expect(skippedIsr({ ...isr, step: 'search' }, false)).toBeNull();
	});
});
