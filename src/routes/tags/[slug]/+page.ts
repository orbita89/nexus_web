import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { KINDS, kindsBySlugs } from '#lib/catalog/kinds.ts';
import { orError, ratingsFor, settle } from '#lib/catalog/load.ts';
import { listPage, SEARCH_MAX_LIMIT } from '#lib/catalog/search.ts';
import { DEFAULT_SORT } from '#lib/catalog/sort.ts';
import { readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /tags/sci-fi?kind=books,games&offset=24. Тег — GET /tags/{slug} (нет — 404), произведения — из
// Meilisearch (listPage).
/** Потолок на случай огромного тега: больше этого за раз не тянем. */
const MAX_SHOWN = 1000;

export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const tag = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/tags/{slug}', { params: { path: { slug: params.slug } } })
		),
		'Такого тега нет.'
	);
	let kinds = kindsBySlugs(readText(url, 'kind'));
	// Без ?kind открыта первая вкладка из тех, где у тега есть работы.
	if (!kinds.length) {
		const by = tag.by_kind;
		const first = KINDS.find(
			(k) => (by[k.kind] ?? 0) > 0 || (k.kind === 'series' && (by.season ?? 0) > 0)
		);
		if (first) kinds = [first];
	}
	/** Ровно один раздел — только тогда он попадает в заголовок и убирается из карточек. */
	const kind = kinds.length === 1 ? kinds[0] : undefined;
	const kindFilter = kinds.map((k) => k.kind);
	const fetchChunk = (offset: number) =>
		listPage(
			api,
			{ tag: params.slug },
			{ kind: kindFilter, sort: DEFAULT_SORT, limit: SEARCH_MAX_LIMIT, offset }
		);
	// Без пагинации: показываем всё. Бэкенд отдаёт по SEARCH_MAX_LIMIT — добираем остальное разом.
	const list = await settle(
		(async () => {
			const first = await fetchChunk(0);
			const total = Math.min(first.total, MAX_SHOWN);
			const offsets: number[] = [];
			for (let o = first.items.length; o < total; o += SEARCH_MAX_LIMIT) offsets.push(o);
			const rest = await Promise.all(offsets.map(fetchChunk));
			return { ...first, items: [...first.items, ...rest.flatMap((r) => r.items)] };
		})()
	);
	const ratings = await ratingsFor(api, list.data?.items ?? []);
	return { tag, kind, kinds, list, ratings };
};
