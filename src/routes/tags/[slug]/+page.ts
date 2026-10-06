import { error } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { kindBySlug } from '#lib/catalog/kinds.ts';
import { orError, settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /tags/sci-fi?kind=books&offset=24. Отдельного GET /tags/{slug} нет: название тега — из списка
// (тегов немного, см. backend-questions.md).
export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const kind = kindBySlug(readText(url, 'kind') ?? '');
	const [tags, list] = await Promise.all([
		orError(unwrap(api.catalog.GET('/api/v1/catalog/tags'))),
		settle(
			unwrap(
				api.catalog.GET('/api/v1/catalog/entities', {
					params: {
						query: { tag: params.slug, kind: kind?.kind, limit: PAGE_SIZE, offset: readOffset(url) }
					}
				})
			)
		)
	]);
	const tag = tags.find((t) => t.slug === params.slug);
	if (!tag) error(404, 'Такого тега нет.');
	return { tag, kind, list };
};
