import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { KINDS } from '#lib/catalog/kinds.ts';
import { ratingsFor, settle } from '#lib/catalog/load.ts';
import { listPage } from '#lib/catalog/search.ts';
import { DEFAULT_SORT } from '#lib/catalog/sort.ts';
import type { PageLoad } from './$types';

const STRIP_SIZE = 12;
const TOP_TAGS = 16;

export const load: PageLoad = async ({ fetch, url }) => {
	const api = publicApi(fetch, url);
	const [sections, tags] = await Promise.all([
		Promise.all(
			KINDS.map(async (k) => ({
				...k,
				result: await settle(
					listPage(api, {}, { kind: k.kind, sort: DEFAULT_SORT, limit: STRIP_SIZE })
				)
			}))
		),
		settle(unwrap(api.catalog.GET('/api/v1/catalog/tags')))
	]);
	// Оценки всех полос — одним запросом.
	const ratings = await ratingsFor(
		api,
		sections.flatMap((s) => s.result.data?.items ?? [])
	);
	return {
		sections,
		ratings,
		// Популярные — с наибольшим числом сущностей; пустые теги не показываем.
		tags: (tags.data ?? [])
			.filter((t) => t.entities_count > 0)
			.toSorted((a, b) => b.entities_count - a.entities_count)
			.slice(0, TOP_TAGS)
	};
};
