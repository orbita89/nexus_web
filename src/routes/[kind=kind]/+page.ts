import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { kindBySlug } from '#lib/catalog/kinds.ts';
import { ratingsFor, settle } from '#lib/catalog/load.ts';
import { readEntitySort } from '#lib/catalog/sort.ts';
import { PAGE_SIZE, readOffset, readText, readYear } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /films?tag=sci-fi&year=2021&q=дюна&sort=rating&offset=24 — всё состояние выдачи в адресе.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const kind = kindBySlug(params.kind)!;
	const filters = { q: readText(url, 'q'), tag: readText(url, 'tag'), year: readYear(url) };
	const sort = readEntitySort(url);
	const api = publicApi(fetch, url);
	const [list, tags] = await Promise.all([
		settle(
			unwrap(
				api.catalog.GET('/api/v1/catalog/entities', {
					params: {
						query: { kind: kind.kind, ...filters, sort, limit: PAGE_SIZE, offset: readOffset(url) }
					}
				})
			)
		),
		settle(unwrap(api.catalog.GET('/api/v1/catalog/tags')))
	]);
	const ratings = await ratingsFor(api, list.data?.items ?? []);
	return {
		kind,
		filters,
		ratings,
		sort,
		list,
		tags: (tags.data ?? []).toSorted((a, b) => a.name.localeCompare(b.name, 'ru'))
	};
};
