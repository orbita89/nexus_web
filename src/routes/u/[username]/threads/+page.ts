import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params }) => {
	const threads = await orError(
		unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/users/{username}/threads', {
				params: {
					path: { username: params.username },
					query: { limit: PAGE_SIZE, offset: readOffset(url) }
				}
			})
		),
		'Такого пользователя нет.'
	);
	return { threads };
};
