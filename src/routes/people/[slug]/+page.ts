import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params }) => {
	const person = await orError(
		unwrap(
			publicApi(fetch, url).catalog.GET('/api/v1/catalog/people/{slug}', {
				params: { path: { slug: params.slug } }
			})
		),
		'Такого человека в каталоге нет.'
	);
	return { person };
};
