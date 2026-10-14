import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

/** Фильтр по основной роли (known_for); пустой — все. */
export const _PEOPLE_ROLES = [
	{ value: undefined, title: 'Все' },
	{ value: 'actor', title: 'Актёры' },
	{ value: 'director', title: 'Режиссёры' },
	{ value: 'writer', title: 'Сценаристы' },
	{ value: 'producer', title: 'Продюсеры' },
	{ value: 'composer', title: 'Композиторы' },
	{ value: 'cinematographer', title: 'Операторы' },
	{ value: 'editor', title: 'Монтажёры' }
] as const;

// /people?q=брэ&role=actor&offset=24 — поиск людей в Meilisearch (GET /search/people): по имени,
// русскому и латиницей, с опечатками и по началу слова; из одинаково подходящих выше известные.
// Без запроса — самые известные: «Популярные люди».
export const load: PageLoad = async ({ fetch, url }) => {
	const q = readText(url, 'q');
	const role = _PEOPLE_ROLES.find((r) => r.value && r.value === readText(url, 'role'))?.value;
	const list = await settle(
		unwrap(
			publicApi(fetch, url).catalog.GET('/api/v1/catalog/search/people', {
				params: { query: { q, known_for: role, limit: PAGE_SIZE, offset: readOffset(url) } }
			})
		)
	);
	return { q, role, list };
};
