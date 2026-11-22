// ИИ-преподаватель: обсуждения книги с ИИ на своём ключе пользователя (бэкенд: catalog::tutor).
// Всё — только вошедшему и только своё; страница книги статическая, поэтому всё по API в браузере.
import type { Api } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import type {
	SchemaAiThread,
	SchemaAiThreadDetail,
	SchemaUserAiProvider
} from '#lib/api/generated/catalog.ts';
import { SseParser } from './sse.ts';

export type AiThread = SchemaAiThread;
export type AiThreadDetail = SchemaAiThreadDetail;
export type AiMessage = AiThreadDetail['messages'][number];
export type UserAiProvider = SchemaUserAiProvider;

export const listBookThreads = (api: Api, slug: string) =>
	unwrap(api.catalog.GET('/api/v1/catalog/books/{slug}/tutor', { params: { path: { slug } } }));

export const createThread = (api: Api, slug: string) =>
	unwrap(
		api.catalog.POST('/api/v1/catalog/books/{slug}/tutor', { params: { path: { slug } }, body: {} })
	);

export const getThread = (api: Api, id: string) =>
	unwrap(api.catalog.GET('/api/v1/catalog/tutor/{id}', { params: { path: { id } } }));

export const deleteThread = (api: Api, id: string) =>
	unwrap(api.catalog.DELETE('/api/v1/catalog/tutor/{id}', { params: { path: { id } } }));

export const listMyThreads = (api: Api, query: { limit?: number; offset?: number } = {}) =>
	unwrap(api.catalog.GET('/api/v1/catalog/me/tutor', { params: { query } }));

export const listProviders = (api: Api) =>
	unwrap(api.catalog.GET('/api/v1/catalog/me/ai-providers'));

/** Вопрос из читалки: выделенный фрагмент, глава, докуда дочитал. */
export interface Question {
	text: string;
	quote?: string | null;
	chapter?: string | null;
	fraction?: number | null;
}

/** Нет своего ключа ИИ — ответ 409 с кодом no_ai_provider: зовём в настройки. */
export class NoProviderError extends Error {}

/**
 * Задать вопрос; ответ приходит потоком — onDelta на каждый кусок. Возвращает id сохранённого
 * ответа. fetch — с токеном (authedFetch): EventSource не умеет POST и заголовки.
 */
export async function ask(
	fetch: (request: Request) => Promise<Response>,
	threadId: string,
	question: Question,
	onDelta: (text: string) => void,
	signal?: AbortSignal
): Promise<string> {
	const response = await fetch(
		new Request(`/api/v1/catalog/tutor/${encodeURIComponent(threadId)}/messages`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
			body: JSON.stringify(question),
			signal
		})
	);
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		if (response.status === 409 && body.includes('no_ai_provider')) throw new NoProviderError();
		let message = '';
		try {
			message = JSON.parse(body).error ?? '';
		} catch {
			// не JSON
		}
		throw new ApiError(response.status, message || null);
	}
	if (!response.body) throw new Error('пустой ответ');
	const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	const parser = new SseParser();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		for (const e of parser.push(value)) {
			const data = JSON.parse(e.data);
			if (e.event === 'delta') onDelta(data.text);
			else if (e.event === 'done') return data.id as string;
			else if (e.event === 'error') throw new Error(data.message || 'модель не ответила');
		}
	}
	throw new Error('ответ оборвался');
}
