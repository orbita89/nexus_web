import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

// Страница премии — такая же статика, как карточка произведения: меняется только из админки,
// бэкенд шлёт сигнал на перерисовку. 'auto', а не true: премия, заведённая после сборки,
// должна открываться сразу.
export const prerender = 'auto';

export const load: PageLoad = async ({ fetch, url, params }) => {
	const award = await orError(
		unwrap(
			publicApi(fetch, url).catalog.GET('/api/v1/catalog/awards/{slug}', {
				params: { path: { slug: params.slug } }
			})
		),
		'Такой премии в каталоге нет.'
	);
	return { award };
};
