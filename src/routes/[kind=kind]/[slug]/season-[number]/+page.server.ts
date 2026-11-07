import { error } from '@sveltejs/kit';
import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { orError } from '#lib/catalog/load.ts';
import type { PageServerLoad } from './$types';

// Страница сезона: /series/arcane/season-2. Адрес — внутри сериала, а не отдельным разделом:
// сезоны в выдачу каталога не попадают, но своя страница у них есть — «аркейн 2 сезон» ищут
// отдельно от «аркейн», и этот запрос должен приводить сюда.
//
// Статика, как и карточка: в data только каталог (сезон, его серии и список сезонов для полосы),
// всё личное и живое грузится в браузере. ISR пересобирает страницу вместе со страницей сериала.
export const prerender = 'auto';

export const load: PageServerLoad = async ({ fetch, url, params }) => {
	// Сезоны есть только у сериалов: /films/dune-2021/season-2 — не адрес.
	if (params.kind !== 'series') error(404, 'Сезоны есть только у сериалов.');

	const api = publicApi(fetch, url);

	// Сначала список сезонов сериала: из него и полоса переключателя, и slug открытого сезона.
	// Слаг не собираем из номера строкой — его задаёт бэкенд, и угадывать его здесь нельзя.
	const seasons = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/entities/{slug}/seasons', {
				params: { path: { slug: params.slug } }
			})
		),
		'Такого сериала в каталоге нет.'
	).then((list) => list.items);

	const number = Number(params.number);
	const current = seasons.find((s) => (s.number ?? 0) === number);
	if (!current) error(404, 'У этого сериала нет такого сезона.');

	const season = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/seasons/{slug}', {
				params: { path: { slug: current.slug } }
			})
		),
		'Такого сезона в каталоге нет.'
	);

	// Серии приходят вместе с сезоном — до MAX_PAGE_SIZE, то есть весь сезон, кроме совсем
	// длинных. Что не влезло — дочитываем страницами через /seasons/{slug}/episodes.
	// Сериал для ссылки над названием: в ответе он есть, но на всякий случай — адрес из params.
	const series = { slug: params.slug, title: season.series?.title ?? params.slug };

	return { entity: season, seasons, episodes: season.episodes, series };
};
