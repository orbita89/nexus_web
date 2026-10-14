import { publicApi, type Api } from '#lib/api/client.ts';
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import type { SchemaArchiveDoc } from '#lib/api/generated/catalog.ts';
import { kindBySlug } from '#lib/catalog/kinds.ts';
import { hasFilters, readFilters } from '#lib/catalog/filters.ts';
import { ratingsFor, settle, type Ratings } from '#lib/catalog/load.ts';
import { personName, searchPage } from '#lib/catalog/search.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /search?q=дюна&kind=books&studio=…&tag=drama&year_from=2000&offset=24 — поиск через
// Meilisearch, фильтры те же, что в разделах (filters.ts).
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
	const filters = readFilters(url);
	const q = filters.q;
	const kind = kindBySlug(readText(url, 'kind') ?? '');
	const api = publicApi(fetch, url);
	// Ни запроса, ни фильтров — подсказка, а не вся база.
	const none: Ratings = {};
	const base = { q, kind, filters, personUnavailable: false };
	const tagsCall = settle(unwrap(api.catalog.GET('/api/v1/catalog/tags')));
	if (!hasFilters({ ...filters, archive: false })) {
		const tags = await tagsCall;
		const empty = { result: null, ratings: none, archive: [], unavailable: false, error: null };
		return { ...base, ...empty, tags: tags.data ?? [], personName: null };
	}

	const [tags, person] = await Promise.all([tagsCall, personName(api, filters.person)]);
	const extra = { tags: tags.data ?? [], personName: person };
	try {
		const { page: result, personUnavailable } = await searchPage(api, filters, {
			kind: kind?.kind,
			limit: PAGE_SIZE,
			offset: readOffset(url)
		});
		// В архиве только фильмы и только поиск по названию.
		const wantArchive =
			!!q && result.total < FEW && result.offset === 0 && (!kind || kind.kind === 'movie');
		const [ratings, archive] = await Promise.all([
			ratingsFor(api, result.items),
			wantArchive ? archiveHint(api, q) : []
		]);
		return {
			...base,
			...extra,
			personUnavailable,
			result,
			ratings,
			archive,
			unavailable: false,
			error: null
		};
	} catch (e) {
		// 503 — Meilisearch недоступен; остальной каталог при этом работает.
		const unavailable = e instanceof ApiError && e.status === 503;
		return {
			...base,
			...extra,
			result: null,
			ratings: none,
			archive: [],
			unavailable,
			error: unavailable ? null : errorMessage(e)
		};
	}
};
