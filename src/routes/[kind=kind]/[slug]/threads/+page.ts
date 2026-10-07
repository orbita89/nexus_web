import { redirect } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { entityHref } from '#lib/catalog/kinds.ts';
import { orError, settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
import { readThreadSort } from '#lib/social/forum.ts';
import type { PageLoad } from './$types';

// /films/dune-2021/threads?sort=new&offset=24 — все темы о произведении.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const path = { slug: params.slug };
	const sort = readThreadSort(url);
	const [entity, threads] = await Promise.all([
		orError(
			unwrap(api.catalog.GET('/api/v1/catalog/entities/{slug}', { params: { path } })),
			'Такого произведения в каталоге нет.'
		),
		settle(
			unwrap(
				api.social.GET('/api/v1/social/entities/{slug}/threads', {
					params: { path, query: { sort, limit: PAGE_SIZE, offset: readOffset(url) } }
				})
			)
		)
	]);

	const href = `${entityHref(entity)}/threads`;
	if (url.pathname !== href) redirect(301, href + url.search);

	return { entity, threads, sort };
};
