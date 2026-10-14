import { error, redirect } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import { entityHref } from '#lib/catalog/kinds.ts';
import type { PageLoad } from './$types';

// /archive/{slug} — фильм из холодного архива: только «скелет» (название, оригинальное название,
// год, постер). Нет в архиве (404) — его могли вернуть на сайт: есть карточка — туда.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const path = { slug: params.slug };
	try {
		const doc = await unwrap(
			api.catalog.GET('/api/v1/catalog/archive/entities/{slug}', { params: { path } })
		);
		return { doc };
	} catch (e) {
		if (!(e instanceof ApiError && e.status === 404)) {
			error(e instanceof ApiError && e.status >= 400 ? e.status : 503, errorMessage(e));
		}
	}
	const entity = await unwrap(
		api.catalog.GET('/api/v1/catalog/entities/{slug}', { params: { path } })
	).catch(() => null);
	// Временный: фильм могут снова убрать в архив.
	if (entity) redirect(307, entityHref(entity));
	error(404, 'Такого фильма нет ни на сайте, ни в архиве.');
};
