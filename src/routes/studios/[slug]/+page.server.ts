import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import { DEFAULT_SORT } from '#lib/catalog/sort.ts';
import { studioFilms } from '#lib/catalog/studios.ts';
import type { PageServerLoad } from './$types';

// Страница студии — статика, как карточка: HTML и __data.json на диске, рисуются при первом
// запросе и по сигналу бэкенда (server/isr.js), когда меняются фильмы студии. При сборке не
// пререндерятся: первое открытие студии бэкенд дополняет из TMDB (1–2 с на студию).
//
// В статике — студия и первая порция фильмов в порядке по умолчанию. Адрес не читаем: nginx
// отдаёт файл без учёта query, другую сортировку (?sort=) и «Показать ещё» страница грузит в
// браузере. Оценки Nexus тоже — в статике они бы устарели.
export const prerender = 'auto';

export const load: PageServerLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	// Фильмы — из Meilisearch по slug студии, параллельно со студией. Тоже orError, а не ошибка на
	// странице: сбой поиска не должен попасть в статику.
	const [studio, films] = await Promise.all([
		orError(
			unwrap(
				api.catalog.GET('/api/v1/catalog/studios/{slug}', {
					params: { path: { slug: params.slug } }
				})
			),
			'Студия не найдена.'
		),
		orError(studioFilms(api, params.slug, DEFAULT_SORT, 0))
	]);
	return { studio, films };
};
