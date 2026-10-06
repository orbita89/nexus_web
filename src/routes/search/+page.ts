import { publicApi } from '#lib/api/client.ts';
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import { kindBySlug } from '#lib/catalog/kinds.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /search?q=дюна&kind=books&offset=24 — поиск через Meilisearch.
export const load: PageLoad = async ({ fetch, url }) => {
	const q = readText(url, 'q');
	const kind = kindBySlug(readText(url, 'kind') ?? '');
	// Пустой запрос — подсказка, а не вся база (пустой q в API вернул бы всё подряд).
	if (!q) return { q, kind, result: null, unavailable: false, error: null };

	try {
		const result = await unwrap(
			publicApi(fetch, url).catalog.GET('/api/v1/catalog/search', {
				params: { query: { q, kind: kind?.kind, limit: PAGE_SIZE, offset: readOffset(url) } }
			})
		);
		return { q, kind, result, unavailable: false, error: null };
	} catch (e) {
		// 503 — Meilisearch недоступен; остальной каталог при этом работает.
		const unavailable = e instanceof ApiError && e.status === 503;
		return { q, kind, result: null, unavailable, error: unavailable ? null : errorMessage(e) };
	}
};
