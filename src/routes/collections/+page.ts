import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /collections?offset=24 — новые публичные коллекции.
export const load: PageLoad = async ({ fetch, url }) => {
	const collections = await settle(
		unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/collections', {
				params: { query: { limit: PAGE_SIZE, offset: readOffset(url) } }
			})
		)
	);
	return { collections };
};
