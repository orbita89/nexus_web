import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { filmography, WORKS_SHOWN } from '#lib/catalog/labels.ts';
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
	const roles = filmography(person.credits);
	// Оценки — одним запросом с лимитом: сначала то, что видно сразу, потом скрытое.
	const ratings = await ratingsFor(
		api,
		[
			...roles.flatMap((r) => r.works.slice(0, WORKS_SHOWN)),
			...roles.flatMap((r) => r.works.slice(WORKS_SHOWN))
		].map((w) => w.entity)
	);
	return { person, roles, ratings };
};
