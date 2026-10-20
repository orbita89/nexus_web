import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

// /chat — каталог общих комнат (заводит админ): больше участников — выше. Комнат немного —
// одна страница до 100.
export const load: PageLoad = async ({ fetch, url }) => {
	const api = publicApi(fetch, url);
	const rooms = await settle(
		unwrap(api.social.GET('/api/v1/social/chat/rooms', { params: { query: { limit: 100 } } }))
	);
	return { rooms };
};
