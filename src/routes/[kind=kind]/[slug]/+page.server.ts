import { redirect } from '@sveltejs/kit';
import { BACKEND_URL, PRERENDER_ENTITIES } from '$app/env/private';
import { createApi, publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { entityHref, kindByApi } from '#lib/catalog/kinds.ts';
import { orError } from '#lib/catalog/load.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// Карточка — статика: HTML и __data.json (данные для переходов в браузере) лежат на диске и
// отдаются nginx. Собираются при сборке (entries), при первом запросе или по сигналу бэкенда
// (server/isr.js). 'auto', а не true: с true маршрут выпадает из серверной сборки, и тогда не
// перерисовать одну карточку и не показать произведение, добавленное после сборки.
export const prerender = 'auto';

/** Сколько произведений брать из API за запрос при сборке (максимум API). */
const PAGE = 100;

export const entries: EntryGenerator = async () => {
	if (!PRERENDER_ENTITIES) return [];
	const api = createApi({ baseUrl: BACKEND_URL, fetch: (request) => fetch(request) });
	const params: Awaited<ReturnType<EntryGenerator>> = [];
	for (let offset = 0, total = Infinity; offset < total; offset += PAGE) {
		const page = await unwrap(
			api.catalog.GET('/api/v1/catalog/entities', { params: { query: { limit: PAGE, offset } } })
		).catch((e) => {
			throw new Error(
				`Пререндер карточек: каталог недоступен по BACKEND_URL=${BACKEND_URL} (${e}). ` +
					'Поднимите бэкенд или соберите без статики: PRERENDER_ENTITIES=0 pnpm build.'
			);
		});
		total = page.total;
		for (const entity of page.items) {
			// Книг сотни тысяч: при сборке их не рендерим. Страница книги собирается при первом
			// заходе (server/isr.js) и дальше раздаётся как готовый HTML.
			if (entity.kind === 'book') continue;
			params.push({ kind: kindByApi(entity.kind).slug, slug: entity.slug });
		}
		if (!page.items.length) break;
	}
	return params;
};

// Только каталог: он одинаков для всех и меняется редко. Оценки, рецензии, обсуждения и
// коллекции в статику не попадают — устарели бы; страница грузит их в браузере.
export const load: PageServerLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const entity = await orError(
		unwrap(
			api.catalog.GET('/api/v1/catalog/entities/{slug}', {
				params: { path: { slug: params.slug } }
			})
		),
		'Такого произведения в каталоге нет.'
	);

	// slug уникален во всём каталоге: /books/dune-2021 — это фильм, правильный адрес один.
	// В статику такой адрес не попадает: ISR удаляет его файлы, и запрос доходит до сервера.
	const href = entityHref(entity);
	if (url.pathname !== href) redirect(301, href + url.search);

	// Сезоны — тот же каталог: список одинаков для всех, рейтинг сезона приходит вместе с ним, и
	// переключатель уходит в статику целиком. Своя оценка зрителя (my_rating) в статике всегда
	// пустая — на таблетках её и не показываем. Сезонов нет или ручка упала — просто нет полосы.
	const seasons =
		entity.kind === 'series'
			? await unwrap(
					api.catalog.GET('/api/v1/catalog/entities/{slug}/seasons', {
						params: { path: { slug: entity.slug } }
					})
				)
					.then((list) => list.items)
					.catch(() => [])
			: [];

	return { entity: forPage(entity), seasons };
};

/** Поля metadata, которые страница не показывает: служебные источники и сырьё для поиска. */
const HIDDEN_META = ['libgen', 'keywords'] as const;

/**
 * Данные карточки попадают в статику дважды — в конец HTML (для гидрации) и в __data.json. Всё,
 * чего страница не рисует (ранжирование, служебные источники книги), — лишний вес в обоих.
 */
function forPage<T extends { metadata: unknown }>(entity: T): T {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- поля отбрасываем
	const { tmdb_popularity, tmdb_votes, rank_score, quality, ...rest } = entity as T & {
		tmdb_popularity?: unknown;
		tmdb_votes?: unknown;
		rank_score?: unknown;
		quality?: unknown;
	};
	const meta = { ...(rest.metadata as Record<string, unknown>) };
	for (const key of HIDDEN_META) delete meta[key];
	// Файл книги: странице нужно только «есть ли» (кнопка «Читать») и размер (прогресс загрузки).
	// Где он лежит в архиве (archive, path) — не для статики.
	const file = meta.file as { size?: number | null } | null | undefined;
	if (file) meta.file = { size: file.size ?? null };
	return { ...rest, metadata: meta } as unknown as T;
}
