import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const q = readText(url, 'q');
	const list = await settle(
		unwrap(
			publicApi(fetch, url).catalog.GET('/api/v1/catalog/people', {
				params: { query: { q, limit: PAGE_SIZE, offset: readOffset(url) } }
			})
		)
	);
	return { q, list };
};
