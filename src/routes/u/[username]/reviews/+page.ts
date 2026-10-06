import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// Рецензии и оценки пользователя (включая оценки без текста), новые сверху. Шапка профиля со
// счётчиками — в блоке профилей; здесь — список.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const reviews = await orError(
		unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/users/{username}/reviews', {
				params: {
					path: { username: params.username },
					query: { limit: PAGE_SIZE, offset: readOffset(url) }
				}
			})
		),
		'Такого пользователя нет.'
	);
	return { username: params.username, reviews };
};
