// Личные отметки: «Посмотреть позже» и «Просмотрено» (у книг — прочитать, у игр — пройти).
// Взаимоисключающие: просмотрел — из «позже» уходит. Подписи и список своих отметок — без Svelte;
// отметка на карточке — Marks (marks.svelte.ts).
import type { Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
import type { SchemaMarkKind, SchemaPageMarkedEntity } from '#lib/api/generated/social.ts';

export type Mark = SchemaMarkKind;

/** Подписи по типу: «Посмотреть позже» / «Просмотрено», «Прочитать позже» / «Прочитано»… */
export function markLabels(kind: SchemaEntityKind): Record<Mark, string> {
	switch (kind) {
		case 'book':
			return { later: 'Прочитать позже', done: 'Прочитано' };
		case 'game':
			return { later: 'Пройти позже', done: 'Пройдено' };
		default:
			return { later: 'Посмотреть позже', done: 'Просмотрено' };
	}
}

/**
 * Свои отметки одного вида, новые сверху — для будущего кабинета (страницы пока нет: в
 * docs/design.md она не описана). Клиент — с токеном (`api` из session).
 */
export function listMyMarks(
	client: Pick<Api, 'social'>,
	kind: Mark,
	{ limit = 24, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<SchemaPageMarkedEntity> {
	return unwrap(
		client.social.GET('/api/v1/social/users/me/marks', {
			params: { query: { kind, limit, offset } }
		})
	);
}

// Главная — статика, поэтому «Отложено» грузится отдельным запросом с токеном. Чтобы не ходить
// за ним на каждом заходе, последний ответ (первые LATER_SHOWN отметок и total) хранится на
// устройстве вместе с именем владельца (чужой вход его не наследует) и временем. Свежий — блок
// рисуется из него без запроса; старше LATER_TTL_MS — спрашиваем сервер. Своя отметка «позже»
// (поставить или снять) кэш сбрасывает; отметка с другого устройства видна через ≤ LATER_TTL_MS.
const LATER_KEY = 'nexus.later';
/** Ключ прежней версии (только «пусто») — убираем при записи. */
const LATER_EMPTY_KEY = 'nexus.later.empty';
export const LATER_SHOWN = 12;
const LATER_TTL_MS = 15 * 60_000;

type Marked = SchemaPageMarkedEntity['items'][number];
export type LaterCache = { user: string; at: number; total: number; items: Marked[] };

/** Свежий кэш «Отложено» этого пользователя или null (нет, чужой, устарел, битый). */
export function readLater(username: string, now = Date.now()): LaterCache | null {
	try {
		const raw = localStorage.getItem(LATER_KEY);
		if (!raw) return null;
		const c = JSON.parse(raw) as LaterCache;
		if (c?.user !== username || typeof c.at !== 'number' || !Array.isArray(c.items)) return null;
		return now - c.at < LATER_TTL_MS && c.at <= now ? c : null;
	} catch {
		return null;
	}
}

/** Запомнить ответ сервера (первая страница отметок «позже»). */
export function saveLater(username: string, page: { total: number; items: readonly Marked[] }) {
	try {
		const c: LaterCache = {
			user: username,
			at: Date.now(),
			total: page.total,
			items: page.items.slice(0, LATER_SHOWN)
		};
		localStorage.setItem(LATER_KEY, JSON.stringify(c));
		localStorage.removeItem(LATER_EMPTY_KEY);
	} catch {
		// Хранилище недоступно или переполнено — просто будем спрашивать сервер.
	}
}

/** Сбросить кэш: своя отметка «позже» поставлена или снята. */
export function dropLater() {
	try {
		localStorage.removeItem(LATER_KEY);
	} catch {
		// нечего сбрасывать
	}
}
