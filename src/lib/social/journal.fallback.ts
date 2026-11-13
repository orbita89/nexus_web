// Журнал из существующих эндпоинтов — пока бэкенд не отдаёт `/journal` (включается при 404).
// Берём лайки на произведения, оценки и рецензии; владельцу — ещё отметки и заметки. Записи
// группируем по произведению. Это упрощённый режим: берём первые 100 записей каждого источника,
// фильтры и поиск применяем к уже загруженному.
import type { Api } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import type { SchemaEntityRef } from '#lib/api/generated/social.ts';
import {
	matchesFilter,
	matchesKind,
	matchesQuery,
	type JournalAction,
	type JournalItem,
	type JournalPage,
	type JournalParams
} from './journal.ts';
import { listMyNotes } from './notes.ts';

const FALLBACK_LIMIT = 100;
const EXCERPT_LENGTH = 200;

/** Сырые данные источников — вход чистой группировки. */
export interface JournalSources {
	likes: { entity: SchemaEntityRef; created_at: string }[];
	ratings: { entity: SchemaEntityRef; rating: number; created_at: string }[];
	reviews: {
		id: string;
		entity: SchemaEntityRef;
		body?: string | null;
		is_spoiler: boolean;
		rating?: number | null;
		created_at: string;
	}[];
	notes: { entity: SchemaEntityRef; body: string; updated_at: string }[];
	marks: { entity: SchemaEntityRef; kind: 'later' | 'done'; created_at: string }[];
}

export const EMPTY_SOURCES: JournalSources = {
	likes: [],
	ratings: [],
	reviews: [],
	notes: [],
	marks: []
};

function excerpt(body: string): string {
	const flat = body.replace(/\s+/g, ' ').trim();
	return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…` : flat;
}

/**
 * Группировка по `entity.id`, свежие сверху. Заметки и отметки попадают в журнал только при
 * `isOwner` — гостю их не показываем, даже если они каким-то образом оказались в источниках.
 */
export function groupJournal(sources: JournalSources, isOwner: boolean): JournalItem[] {
	const byEntity = new Map<string, JournalItem>();

	function touch(entity: SchemaEntityRef, at: string, action: JournalAction): JournalItem {
		let item = byEntity.get(entity.id);
		if (!item) {
			item = { entity, actions: [], last_activity_at: at };
			byEntity.set(entity.id, item);
		}
		if (!item.actions.includes(action)) item.actions.push(action);
		if (at > item.last_activity_at) item.last_activity_at = at;
		return item;
	}

	for (const l of sources.likes) touch(l.entity, l.created_at, 'like');
	for (const r of sources.ratings) {
		touch(r.entity, r.created_at, 'rating').rating = r.rating;
	}
	for (const r of sources.reviews) {
		if (r.rating != null) touch(r.entity, r.created_at, 'rating').rating = r.rating;
		if (r.body) {
			touch(r.entity, r.created_at, 'review').review = {
				id: r.id,
				body: r.body,
				is_spoiler: r.is_spoiler,
				excerpt: excerpt(r.body)
			};
		}
	}
	if (isOwner) {
		for (const n of sources.notes) touch(n.entity, n.updated_at, 'note').note = { body: n.body };
		for (const m of sources.marks) touch(m.entity, m.created_at, m.kind).mark = m.kind;
	}

	return [...byEntity.values()].sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at));
}

/** Фильтры и поиск по собранному; курсор — смещение строкой. */
export function pageJournal(items: JournalItem[], params: JournalParams, limit: number): JournalPage {
	const filtered = items.filter(
		(i) =>
			matchesFilter(i, params.filter) && matchesKind(i, params.kind) && matchesQuery(i, params.q)
	);
	const start = Number(params.cursor) || 0;
	const end = start + limit;
	return {
		items: filtered.slice(start, end),
		next_cursor: end < filtered.length ? String(end) : null
	};
}

/** Закрытый источник (403 `stats_private`) — не сбой, а пустой список. */
async function orEmpty<T>(request: Promise<T[]>): Promise<T[]> {
	try {
		return await request;
	} catch (e) {
		if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return [];
		throw e;
	}
}

export async function buildJournalFallback(
	client: Api,
	username: string,
	params: JournalParams,
	isOwner: boolean
): Promise<JournalPage> {
	const path = { username };
	const query = { limit: FALLBACK_LIMIT };
	const [likes, ratings, reviews, notes, marks] = await Promise.all([
		orEmpty(
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/likes/given', {
					params: { path, query: { ...query, target: 'entity' } }
				})
			).then((p) =>
				p.items.flatMap((i) =>
					i.target.kind === 'entity' && i.value === 1
						? [{ entity: i.target.entity, created_at: i.created_at }]
						: []
				)
			)
		),
		orEmpty(
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/ratings', {
					params: { path, query }
				})
			).then((p) => p.items)
		),
		orEmpty(
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/reviews', {
					params: { path, query }
				})
			).then((p) => p.items)
		),
		isOwner
			? orEmpty(listMyNotes(client, { limit: FALLBACK_LIMIT }).then((p) => p.items))
			: Promise.resolve([]),
		isOwner
			? orEmpty(
					unwrap(
						client.social.GET('/api/v1/social/users/me/marks', { params: { query } })
					).then((p) => p.items)
				)
			: Promise.resolve([])
	]);
	const items = groupJournal({ likes, ratings, reviews, notes, marks }, isOwner);
	return pageJournal(items, params, params.limit ?? 20);
}
