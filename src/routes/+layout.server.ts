import { publicApi } from '#lib/api/client.ts';
import { safeBanners } from '#lib/catalog/banners.ts';
import type { LayoutServerLoad } from './$types';

// Баннеры страницы — один раз в корневом layout, на сервере (SSR), по пути страницы.
// Читаем только url.pathname: смена query (фильтры, поиск) баннеры не перезапрашивает.
// Для /admin* не ходим вовсе (бэкенд там всё равно отдаёт []).
export const load: LayoutServerLoad = async ({ fetch, url }) => {
	const path = url.pathname;
	if (path === '/admin' || path.startsWith('/admin/')) return { banners: [] };
	return { banners: await safeBanners(publicApi(fetch, url), path) };
};
