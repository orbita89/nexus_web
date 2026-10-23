import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import { roomSort } from '#lib/chat/rooms.ts';
import type { PageLoad } from './$types';

// /chat — каталог общих комнат (заводит админ). Порядок: активные за сутки, по участникам
// или новые (ROOM_SORTS). Комнат немного — одна страница до 100.
export const load: PageLoad = async ({ fetch, url }) => {
	const api = publicApi(fetch, url);
	const sort = roomSort(url.searchParams.get('sort'));
	// sort бэкенд пока не поддерживает — не шлём, порядок у него свой (системные сверху).
	const rooms = await settle(
		unwrap(api.social.GET('/api/v1/social/chat/rooms', { params: { query: { limit: 100 } } }))
	);
	return { rooms, sort };
};
