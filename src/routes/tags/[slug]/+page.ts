import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { kindsBySlugs } from '#lib/catalog/kinds.ts';
import { orError, ratingsFor, settle } from '#lib/catalog/load.ts';
import { listPage } from '#lib/catalog/search.ts';
import { DEFAULT_SORT } from '#lib/catalog/sort.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /tags/sci-fi?kind=books,games&offset=24. Тег — GET /tags/{slug} (нет — 404), произведения — из
// Meilisearch (listPage).
export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const kinds = kindsBySlugs(readText(url, 'kind'));
	/** Ровно один раздел — только тогда он попадает в заголовок и убирается из карточек. */
	const kind = kinds.length === 1 ? kinds[0] : undefined;
	const [tag, list] = await Promise.all([
		orError(
			unwrap(
				api.catalog.GET('/api/v1/catalog/tags/{slug}', { params: { path: { slug: params.slug } } })
			),
			'Такого тега нет.'
		),
		settle(
			listPage(
				api,
				{ tag: params.slug },
				{
					kind: kinds.map((k) => k.kind),
					sort: DEFAULT_SORT,
					limit: PAGE_SIZE,
					offset: readOffset(url)
				}
			)
		)
	]);
	const ratings = await ratingsFor(api, list.data?.items ?? []);
	return { tag, kind, kinds, list, ratings };
};
