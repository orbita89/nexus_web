import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import type { LayoutLoad } from './$types';

// Шапка профиля для всех вкладок /u/{username}/*. Сервер рендерит её как для гостя
// (relation = null); подписка вошедшего уточняется в браузере (FollowButton).
export const load: LayoutLoad = async ({ fetch, url, params }) => {
	const profile = await orError(
		unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/users/{username}', {
				params: { path: { username: params.username } }
			})
		),
		'Такого пользователя нет.'
	);
	return { profile };
};
