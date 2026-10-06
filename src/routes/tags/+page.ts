import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const tags = await settle(unwrap(publicApi(fetch, url).catalog.GET('/api/v1/catalog/tags')));
	return { tags };
};
