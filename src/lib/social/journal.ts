// Журнал профиля: всё, что человек делал с произведениями, — по одной записи на произведение.
// Лайки, оценки, рецензии, реакции — публичны (в рамках приватности статистики), а заметки и
// отметки «позже»/«просмотрено» бэкенд отдаёт только владельцу: фронт их не фильтрует, а лишь
// не просит у гостя. Эндпоинт `/journal` описан в docs/backend-tasks/journal.md; пока его нет
// (404), страница собирает журнал из существующих эндпоинтов (journal.fallback.ts).
import type { Api } from '#lib/api/client.ts';
import type { SchemaEntityRef } from '#lib/api/generated/social.ts';
import { buildJournalFallback } from './journal.fallback.ts';

export type JournalFilter = 'all' | 'likes' | 'reviews' | 'notes' | 'later' | 'ratings';
export type JournalKind = 'movie' | 'series' | 'book' | 'game';
export type JournalAction = 'like' | 'review' | 'rating' | 'note' | 'later' | 'done' | 'reaction';

export interface JournalItem {
	entity: SchemaEntityRef;
	actions: JournalAction[];
	last_activity_at: string;
	rating?: number;
	review?: { id: string; body: string; is_spoiler: boolean; excerpt: string } | null;
	/** Только владельцу. */
	note?: { body: string } | null;
	/** Только владельцу. */
	mark?: 'later' | 'done' | null;
}

export interface JournalPage {
	items: JournalItem[];
	next_cursor: string | null;
}

export interface JournalParams {
	filter: JournalFilter;
	kind?: JournalKind;
	q?: string;
	limit?: number;
	cursor?: string | null;
}

export const JOURNAL_FILTERS: readonly { value: JournalFilter; title: string; ownerOnly: boolean }[] =
	[
		{ value: 'all', title: 'Все', ownerOnly: false },
		{ value: 'likes', title: 'Лайки', ownerOnly: false },
		{ value: 'reviews', title: 'Рецензии', ownerOnly: false },
		{ value: 'notes', title: 'Заметки', ownerOnly: true },
		{ value: 'later', title: 'Посмотреть позже', ownerOnly: true },
		{ value: 'ratings', title: 'Оценки', ownerOnly: false }
	];

export const JOURNAL_KINDS: readonly { value: JournalKind; title: string }[] = [
	{ value: 'movie', title: 'Фильмы' },
	{ value: 'series', title: 'Сериалы' },
	{ value: 'book', title: 'Книги' },
	{ value: 'game', title: 'Игры' }
];

export const JOURNAL_PAGE_SIZE = 20;

/** Разбор `?filter=&kind=&q=`; неизвестное — по умолчанию, приватные фильтры гостю — «Все». */
export function readJournalParams(url: { searchParams: { get(name: string): string | null } }, isOwner: boolean): JournalParams {
	const rawFilter = url.searchParams.get('filter');
	const found = JOURNAL_FILTERS.find((f) => f.value === rawFilter);
	const filter = found && (isOwner || !found.ownerOnly) ? found.value : 'all';
	const rawKind = url.searchParams.get('kind');
	const kind = JOURNAL_KINDS.find((k) => k.value === rawKind)?.value;
	const q = url.searchParams.get('q')?.trim() || undefined;
	return { filter, kind, q };
}

const ACTION_LABELS: Record<JournalAction, { icon: string; title: string }> = {
	like: { icon: '♥', title: 'Лайк' },
	review: { icon: '✍️', title: 'Рецензия' },
	rating: { icon: '★', title: 'Оценка' },
	note: { icon: '📝', title: 'Заметка' },
	later: { icon: '🔖', title: 'Посмотреть позже' },
	done: { icon: '✓', title: 'Просмотрено' },
	reaction: { icon: '🔥', title: 'Реакция' }
};

/** Подпись и иконка чипа действия. */
export function journalActionLabel(action: JournalAction): { icon: string; title: string } {
	return ACTION_LABELS[action];
}

export function matchesFilter(item: JournalItem, filter: JournalFilter): boolean {
	switch (filter) {
		case 'all':
			return true;
		case 'likes':
			return item.actions.includes('like');
		case 'reviews':
			return item.actions.includes('review');
		case 'notes':
			return item.actions.includes('note');
		case 'later':
			return item.actions.includes('later');
		case 'ratings':
			return item.actions.includes('rating');
	}
}

export function matchesKind(item: JournalItem, kind: JournalKind | undefined): boolean {
	return !kind || item.entity.kind === kind;
}

/** Регистр и «ё» не важны: «Ёжик» находится по «ежик». */
function normalize(s: string): string {
	return s.toLowerCase().replaceAll('ё', 'е').trim();
}

export function matchesQuery(item: JournalItem, q: string | undefined): boolean {
	const needle = q ? normalize(q) : '';
	return !needle || normalize(item.entity.title).includes(needle);
}

/**
 * Журнал владельца или гостя. `isOwner` решает только, просить ли у фолбэка приватные источники:
 * основной эндпоинт сам не отдаст гостю лишнего.
 */
export async function loadJournal(
	client: Api,
	username: string,
	params: JournalParams,
	isOwner: boolean
): Promise<JournalPage> {
	const query = {
		filter: params.filter,
		kind: params.kind,
		q: params.q,
		limit: params.limit ?? JOURNAL_PAGE_SIZE,
		cursor: params.cursor ?? undefined
	};
	// Путь пока не в сгенерированном контракте — вызов через приведение, как у заметок.
	const raw = client.social as unknown as {
		GET(
			path: string,
			init: unknown
		): Promise<{ data?: JournalPage; error?: unknown; response: Response }>;
	};
	const { data, response } = await raw.GET('/api/v1/social/users/{username}/journal', {
		params: { path: { username }, query }
	});
	if (response.status === 404) return buildJournalFallback(client, username, params, isOwner);
	if (!response.ok || !data) throw new Error('Не удалось загрузить журнал.');
	return data;
}

/**
 * Число записей журнала из шапки профиля. `null` — закрыто (аналитика не открыта) или поля ещё
 * нет: счётчик тогда не выводим. Поле пока не в сгенерированном контракте — читаем мягко.
 */
export function journalCountOf(profile: object): number | null {
	const n = (profile as { journal_count?: number | null }).journal_count;
	return typeof n === 'number' ? n : null;
}
