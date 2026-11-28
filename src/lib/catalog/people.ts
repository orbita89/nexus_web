import type { Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { PAGE_SIZE } from '#lib/catalog/url.ts';

// Список людей /people: поиск в Tantivy (GET /search/people) по имени, русскому и латиницей, с
// опечатками и по началу слова; из одинаково подходящих выше известные. Без запроса — самые
// известные: «Популярные люди». Нужен и серверу (статика — «Популярные» без фильтров), и браузеру
// (?q=, ?role=).

/** Без поиска первые три человека идут крупно, поверх обычных 24 — сетка под ними ровная. */
const PODIUM = 3;

/** Фильтр по основной роли (known_for); пустой — все. */
export const PEOPLE_ROLES = [
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

/** Первая страница выдачи. */
export function peopleList(api: Pick<Api, 'catalog'>, q?: string, role?: string) {
	return unwrap(
		api.catalog.GET('/api/v1/catalog/search/people', {
			params: {
				query: { q, known_for: role, limit: q ? PAGE_SIZE : PAGE_SIZE + PODIUM, offset: 0 }
			}
		})
	);
}
