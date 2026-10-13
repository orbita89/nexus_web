import { publicApi, type Api } from '#lib/api/client.ts';
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import type { SchemaArchiveDoc } from '#lib/api/generated/catalog.ts';
import { kindBySlug } from '#lib/catalog/kinds.ts';
import { ratingsFor, type Ratings } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /search?q=дюна&kind=books&offset=24 — поиск через Meilisearch.
// Нашлось меньше FEW на первой странице — подсказка «В архиве»: фильмы, которых нет на сайте.
const FEW = 3;
const ARCHIVE_HINT_LIMIT = 5;

/** Архив — дополнение: любая ошибка (в том числе 503) — просто без блока. */
async function archiveHint(api: Api, q: string): Promise<SchemaArchiveDoc[]> {
	try {
		const hits = await unwrap(
			api.catalog.GET('/api/v1/catalog/archive/search', {
				params: { query: { q, limit: ARCHIVE_HINT_LIMIT } }
			})
		);
		return hits.items;
	} catch {
		return [];
	}
}

export const load: PageLoad = async ({ fetch, url }) => {
	const q = readText(url, 'q');
	const kind = kindBySlug(readText(url, 'kind') ?? '');
	// Пустой запрос — подсказка, а не вся база (пустой q в API вернул бы всё подряд).
	const none: Ratings = {};
	if (!q)
		return { q, kind, result: null, ratings: none, archive: [], unavailable: false, error: null };

	const api = publicApi(fetch, url);
	try {
		const result = await unwrap(
			api.catalog.GET('/api/v1/catalog/search', {
				params: { query: { q, kind: kind?.kind, limit: PAGE_SIZE, offset: readOffset(url) } }
			})
		);
		// В архиве только фильмы: в разделах книг, игр, сериалов подсказка не к месту.
		const wantArchive =
			result.total < FEW && result.offset === 0 && (!kind || kind.kind === 'movie');
		const [ratings, archive] = await Promise.all([
			ratingsFor(api, result.items),
			wantArchive ? archiveHint(api, q) : []
		]);
		return { q, kind, result, ratings, archive, unavailable: false, error: null };
	} catch (e) {
		// 503 — Meilisearch недоступен; остальной каталог при этом работает.
		const unavailable = e instanceof ApiError && e.status === 503;
		return {
			q,
			kind,
			result: null,
			ratings: none,
			archive: [],
			unavailable,
			error: unavailable ? null : errorMessage(e)
		};
	}
};
