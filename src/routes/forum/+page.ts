import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
import { readThreadSort } from '#lib/social/forum.ts';
import type { PageLoad } from './$types';

// /forum?sort=new&offset=24 — темы всего форума.
export const load: PageLoad = async ({ fetch, url }) => {
	const sort = readThreadSort(url);
	const threads = await settle(
		unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/threads', {
				params: { query: { sort, limit: PAGE_SIZE, offset: readOffset(url) } }
			})
		)
	);
	return { sort, threads };
};
