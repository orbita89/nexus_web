import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import { readOffset } from '#lib/catalog/url.ts';
import { POSTS_PAGE } from '#lib/social/forum.ts';
import type { PageLoad } from './$types';

// /forum/{id}?offset=50 — тема и страница сообщений по времени.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const thread = await orError(
		unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/threads/{id}', {
				params: { path: { id: params.id }, query: { limit: POSTS_PAGE, offset: readOffset(url) } }
			})
		),
		'Такой темы нет.'
	);
	return { thread };
};
