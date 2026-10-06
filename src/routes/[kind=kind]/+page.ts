import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { kindBySlug } from '#lib/catalog/kinds.ts';
import { settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset, readText, readYear } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /films?tag=sci-fi&year=2021&q=дюна&offset=24 — всё состояние выдачи в адресе.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const kind = kindBySlug(params.kind)!;
	const filters = { q: readText(url, 'q'), tag: readText(url, 'tag'), year: readYear(url) };
	const api = publicApi(fetch, url);
	const [list, tags] = await Promise.all([
		settle(
			unwrap(
				api.catalog.GET('/api/v1/catalog/entities', {
					params: {
						query: { kind: kind.kind, ...filters, limit: PAGE_SIZE, offset: readOffset(url) }
					}
				})
			)
		),
		settle(unwrap(api.catalog.GET('/api/v1/catalog/tags')))
	]);
	return {
		kind,
		filters,
		list,
		tags: (tags.data ?? []).toSorted((a, b) => a.name.localeCompare(b.name, 'ru'))
	};
};
