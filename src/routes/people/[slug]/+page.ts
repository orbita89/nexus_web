import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError, ratingsFor } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const person = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/people/{slug}', {
				params: { path: { slug: params.slug } }
			})
		),
		'Такого человека в каталоге нет.'
	);
	const ratings = await ratingsFor(
		api,
		person.credits.map((c) => c.entity)
	);
	return { person, ratings };
};
