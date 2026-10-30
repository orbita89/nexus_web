import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /collections?q=космос&offset=24 — новые публичные коллекции, а с запросом — поиск по
// названию и описанию (Meilisearch; приватных в индексе нет вовсе).
export const load: PageLoad = async ({ fetch, url }) => {
	const q = readText(url, 'q');
	const collections = await settle(
		unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/collections', {
				params: { query: { q, limit: PAGE_SIZE, offset: readOffset(url) } }
			})
		)
	);
	return { q, collections };
};
