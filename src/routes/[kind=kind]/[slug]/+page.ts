import { redirect } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { entityHref } from '#lib/catalog/kinds.ts';
import { orError, settle } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const path = { slug: params.slug };
	const [entity, rating] = await Promise.all([
		orError(
			unwrap(api.catalog.GET('/api/v1/catalog/entities/{slug}', { params: { path } })),
			'Такого произведения в каталоге нет.'
		),
		// Сводка оценок — из social; если она не загрузилась, карточка всё равно показывается.
		settle(unwrap(api.social.GET('/api/v1/social/entities/{slug}/rating', { params: { path } })))
	]);

	// slug уникален во всём каталоге: /books/dune-2021 — это фильм, правильный адрес один.
	const href = entityHref(entity);
	if (url.pathname !== href) redirect(301, href + url.search);

	return { entity, rating: rating.data };
};
