import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { readAwardKind } from '#lib/catalog/awards.ts';
import { settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /awards?kind=movie&q=оскар&offset=24 — список премий. Вкладка (тип работ) и поиск живут в
// адресе: ссылкой на «Игры» можно поделиться, и она открывается сразу нужной вкладкой.
export const load: PageLoad = async ({ fetch, url }) => {
	const kind = readAwardKind(readText(url, 'kind'));
	const q = readText(url, 'q');
	const list = await settle(
		unwrap(
			publicApi(fetch, url).catalog.GET('/api/v1/catalog/awards', {
				params: { query: { kind, q, limit: PAGE_SIZE, offset: readOffset(url) } }
			})
		)
	);
	return { kind, q, list };
};
