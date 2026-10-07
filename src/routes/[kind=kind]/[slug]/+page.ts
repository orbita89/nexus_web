import { redirect } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { entityHref } from '#lib/catalog/kinds.ts';
import { orError, settle } from '#lib/catalog/load.ts';
import { readSort } from '#lib/social/reviews.ts';
import type { PageLoad } from './$types';

/** Рецензий на карточке; остальные — на /{раздел}/{slug}/reviews. */
const CARD_REVIEWS = 6;
const CARD_THREADS = 5;
const CARD_COLLECTIONS = 6;

export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const path = { slug: params.slug };
	const sort = readSort(url);
	const [entity, rating, reviews, threads, collections] = await Promise.all([
		orError(
			unwrap(api.catalog.GET('/api/v1/catalog/entities/{slug}', { params: { path } })),
			'Такого произведения в каталоге нет.'
		),
		// Сводка и рецензии — из social: не загрузились — карточка всё равно показывается.
		settle(unwrap(api.social.GET('/api/v1/social/entities/{slug}/rating', { params: { path } }))),
		settle(
			unwrap(
				api.social.GET('/api/v1/social/entities/{slug}/reviews', {
					params: { path, query: { sort, limit: CARD_REVIEWS } }
				})
			)
		),
		// Обсуждения: темы, где есть это произведение (в том числе вместе с другими).
		settle(
			unwrap(
				api.social.GET('/api/v1/social/entities/{slug}/threads', {
					params: { path, query: { limit: CARD_THREADS } }
				})
			)
		),
		// Публичные коллекции, где есть это произведение.
		settle(
			unwrap(
				api.social.GET('/api/v1/social/entities/{slug}/collections', {
					params: { path, query: { limit: CARD_COLLECTIONS } }
				})
			)
		)
	]);

	// slug уникален во всём каталоге: /books/dune-2021 — это фильм, правильный адрес один.
	const href = entityHref(entity);
	if (url.pathname !== href) redirect(301, href + url.search);

	return { entity, rating: rating.data, reviews, threads, collections, sort };
};
