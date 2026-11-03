import { publicApi } from '#lib/api/client.ts';
import { kindsBySlugs } from '#lib/catalog/kinds.ts';
import { settle } from '#lib/catalog/load.ts';
import { listTags } from '#lib/catalog/tags.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	// Раздел из адреса: ?kind=paintings. Вкладки одиночные — берём первый подходящий,
	// сужает список сам бэкенд (?entity_kind=painting).
	const kind = kindsBySlugs(url.searchParams.get('kind') ?? undefined)[0];
	const tags = await settle(listTags(publicApi(fetch, url), kind?.kind));
	return { tags, kind };
};
