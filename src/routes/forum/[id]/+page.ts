import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import { readOffset } from '#lib/catalog/url.ts';
import { lastPageOffset, POSTS_PAGE } from '#lib/social/forum.ts';
import type { PageLoad } from './$types';

// /forum/{id}?offset=50 — тема и страница сообщений по времени.
// /forum/{id}?post=<id> — ссылка из уведомления об ответе: «какая страница у сообщения» API не
// отдаёт, а ответ свежий, поэтому если его нет на первой странице — берём последнюю.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const get = (offset: number) =>
		orError(
			unwrap(
				api.social.GET('/api/v1/social/threads/{id}', {
					params: { path: { id: params.id }, query: { limit: POSTS_PAGE, offset } }
				})
			),
			'Такой темы нет.'
		);
	let thread = await get(readOffset(url));
	const post = url.searchParams.get('post');
	if (post && !url.searchParams.has('offset') && !thread.posts.items.some((p) => p.id === post)) {
		const last = lastPageOffset(thread.posts.total, POSTS_PAGE);
		if (last > 0) thread = await get(last);
	}
	return { thread };
};
