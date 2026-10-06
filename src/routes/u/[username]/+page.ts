import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

// Обзор профиля: последние рецензии и темы. Шапка — в +layout.ts.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const path = { username: params.username };
	const [reviews, threads] = await Promise.all([
		settle(
			unwrap(
				api.social.GET('/api/v1/social/users/{username}/reviews', {
					params: { path, query: { limit: 4 } }
				})
			)
		),
		settle(
			unwrap(
				api.social.GET('/api/v1/social/users/{username}/threads', {
					params: { path, query: { limit: 5 } }
				})
			)
		)
	]);
	return { reviews, threads };
};
