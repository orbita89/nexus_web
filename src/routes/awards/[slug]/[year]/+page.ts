import { error } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError, ratingsFor } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

// Церемония — статика, как карточка: правка в админке присылает сигнал на перерисовку.
export const prerender = 'auto';

export const load: PageLoad = async ({ fetch, url, params }) => {
	// Год в адресе — четыре цифры: кривой не уходит в API (там он int и дал бы 400).
	if (!/^\d{4}$/.test(params.year)) error(404, 'Такой церемонии нет.');
	const api = publicApi(fetch, url);
	const edition = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/awards/{slug}/{year}', {
				params: { path: { slug: params.slug, year: Number(params.year) } }
			})
		),
		'Такой церемонии в каталоге нет.'
	);
	// Оценки — как в сетке каталога: один пакетный запрос, сначала победители.
	const works = edition.categories.flatMap((c) =>
		c.nominations.toSorted((a, b) => Number(b.won) - Number(a.won)).flatMap((n) => n.entity ?? [])
	);
	const ratings = await ratingsFor(api, works);
	return { edition, ratings };
};
