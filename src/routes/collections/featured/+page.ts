import { publicApi } from '#lib/api/client.ts';
import { settle } from '#lib/catalog/load.ts';
import { getFeaturedCollections } from '#lib/social/collections.ts';
import type { PageLoad } from './$types';

// /collections/featured — все особые подборки в порядке API (SSR).
// Статический маршрут сильнее [id]; slug «featured» зарезервирован бэкендом.
export const load: PageLoad = async ({ fetch, url }) => {
	const featured = await settle(getFeaturedCollections(publicApi(fetch, url)));
	return { featured };
};
