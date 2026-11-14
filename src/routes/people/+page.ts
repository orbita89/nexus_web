import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { settle } from '#lib/catalog/load.ts';
import { PAGE_SIZE, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

/** Без поиска первые три человека идут крупно, поверх обычных 24 — сетка под ними ровная. */
const PODIUM = 3;

/** Фильтр по основной роли (known_for); пустой — все. */
export const _PEOPLE_ROLES = [
	{ value: undefined, title: 'Все' },
	{ value: 'actor', title: 'Актёры' },
	{ value: 'director', title: 'Режиссёры' },
	{ value: 'writer', title: 'Сценаристы' },
	{ value: 'producer', title: 'Продюсеры' },
	{ value: 'composer', title: 'Композиторы' },
	{ value: 'cinematographer', title: 'Операторы' },
	{ value: 'editor', title: 'Монтажёры' },
	{ value: 'voice_actor', title: 'Озвучка' },
	{ value: 'author', title: 'Авторы книг' },
	{ value: 'illustrator', title: 'Иллюстраторы' },
	{ value: 'artist', title: 'Художники' },
	{ value: 'creator', title: 'Создатели' },
	{ value: 'developer', title: 'Разработчики' },
	{ value: 'game_designer', title: 'Геймдизайнеры' }
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
				params: { query: { q, known_for: role, limit: q ? PAGE_SIZE : PAGE_SIZE + PODIUM, offset: 0 } }
			})
		)
	);
	return { q, role, list };
};
