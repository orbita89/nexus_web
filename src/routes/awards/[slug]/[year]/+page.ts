import { error } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

// Церемония — статика, как карточка: правка в админке присылает сигнал на перерисовку.
export const prerender = 'auto';

export const load: PageLoad = async ({ fetch, url, params }) => {
	// Год в адресе — четыре цифры: кривой не уходит в API (там он int и дал бы 400).
	if (!/^\d{4}$/.test(params.year)) error(404, 'Такой церемонии нет.');
	const edition = await orError(
		unwrap(
			publicApi(fetch, url).catalog.GET('/api/v1/catalog/awards/{slug}/{year}', {
				params: { path: { slug: params.slug, year: Number(params.year) } }
			})
		),
		'Такой церемонии в каталоге нет.'
	);
	return { edition };
};
