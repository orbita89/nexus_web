import { redirect } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { entityHref } from '#lib/catalog/kinds.ts';
import { orError } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	// Сводка оценок (GET /social/entities/{slug}/rating, компонент RatingSummary) временно не
	// показывается — решение продукта; вернуть — запросить её здесь параллельно через settle().
	const entity = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/entities/{slug}', {
				params: { path: { slug: params.slug } }
			})
		),
		'Такого произведения в каталоге нет.'
	);

	// slug уникален во всём каталоге: /books/dune-2021 — это фильм, правильный адрес один.
	const href = entityHref(entity);
	if (url.pathname !== href) redirect(301, href + url.search);

	return { entity };
};
