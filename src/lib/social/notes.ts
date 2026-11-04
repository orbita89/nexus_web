// Личная заметка о произведении: её не видит никто, кроме автора. Это не рецензия — рецензия
// публична и идёт в ленту, а заметка нужна для себя: «посмотреть перед второй частью», «советовал
// Паша». Оценка 1–10 при этом живёт в рецензии и остаётся публичной.
//
// Бэкенд готов (nexus_project `83a68d2`), но контракт documents/api/social.json он не
// перегенерировал — в generated/social.ts ни эндпоинтов, ни схем. Поэтому формы описаны здесь, а
// вызовы идут через приведение. Когда контракт обновят: `pnpm api:types`, отсюда уходят типы и
// касты, остаётся только тонкая обёртка над api.
import type { Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import type { SchemaEntityRef } from '#lib/api/generated/social.ts';

/** Столько же, сколько у рецензии: бэкенд режет на 10 000 символов. */
export const NOTE_LIMIT = 10_000;

export interface Note {
	id: string;
	body: string;
	created_at: string;
	updated_at: string;
}

/** Заметка в своём списке — с произведением, к которому написана. */
export interface NoteWithEntity extends Note {
	entity: SchemaEntityRef;
}

export interface NotesPage {
	items: NoteWithEntity[];
	total: number;
	limit: number;
	offset: number;
}

/** Клиент с токеном: заметки не отдаются никому, кроме автора. */
type Social = Pick<Api, 'social'>;

/** Своя заметка о произведении; 404 — её нет (ловит вызывающий). */
export function getNote(client: Social, slug: string): Promise<Note> {
	return unwrap(
		(client.social as unknown as RawSocial).GET<Note>('/api/v1/social/entities/{slug}/note', {
			params: { path: { slug } }
		})
	);
}

/** Создать или заменить целиком. Пустой текст бэкенд не принимает — для этого removeNote. */
export function putNote(client: Social, slug: string, body: string): Promise<Note> {
	return unwrap(
		(client.social as unknown as RawSocial).PUT<Note>('/api/v1/social/entities/{slug}/note', {
			params: { path: { slug } },
			body: { body }
		})
	);
}

export function removeNote(client: Social, slug: string): Promise<void> {
	return unwrap(
		(client.social as unknown as RawSocial).DELETE<void>('/api/v1/social/entities/{slug}/note', {
			params: { path: { slug } }
		})
	);
}

/** Свои заметки, новые сверху. Чужого списка у бэкенда нет как маршрута. */
export function listMyNotes(
	client: Social,
	{ limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<NotesPage> {
	return unwrap(
		(client.social as unknown as RawSocial).GET<NotesPage>('/api/v1/social/users/me/notes', {
			params: { query: { limit, offset } }
		})
	);
}

/**
 * Клиент без типов контракта: путей заметок в нём ещё нет (см. комментарий сверху). Форма ответа
 * — та же, что у openapi-fetch: `{ data, error, response }`, её ждёт unwrap().
 */
type RawResult<T> = Promise<{ data?: T; error?: unknown; response: Response }>;
interface RawSocial {
	GET<T>(path: string, init: unknown): RawResult<T>;
	PUT<T>(path: string, init: unknown): RawResult<T>;
	DELETE<T>(path: string, init: unknown): RawResult<T>;
}
