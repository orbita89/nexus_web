// Списки каталога — из Meilisearch (GET /search): разделы (/films), общая страница /search,
// главная, теги, студии. Любая сортировка, фильтрация и поиск — только так (docs/README.md): в
// PostgreSQL (GET /entities) сортировка всего каталога бывает по 7 с, у Meilisearch — десятки
// миллисекунд. total у поиска точный.
import type { Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import type { SchemaEntityKind, SchemaSearchSort } from '#lib/api/generated/catalog.ts';
import { searchSortParam, type CatalogFilters, type Mode } from './filters.ts';
import { PAGE_SIZE } from './url.ts';

/** Страница поиска с фильтрами из адреса; studioSlug — фильмы страницы студии. */
export function searchPage(
	api: Api,
	f: CatalogFilters,
	options: {
		/** Один тип или несколько: API принимает повторяющийся `kind` (ИЛИ между типами). */
		kind?: SchemaEntityKind | readonly SchemaEntityKind[];
		sort?: SchemaSearchSort;
		studioSlug?: string;
		limit: number;
		offset: number;
	}
) {
	const kinds = options.kind === undefined ? [] : [options.kind].flat();
	const query = {
		kind: kinds.length ? kinds : undefined,
		q: f.q,
		tag: f.tag,
		year: f.year,
		year_from: f.yearFrom,
		year_to: f.yearTo,
		studio: f.studio,
		studio_slug: options.studioSlug,
		person: f.person,
		role: f.person ? f.role : undefined,
		award: f.award,
		award_year: f.award ? f.awardYear : undefined,
		awarded: f.awarded,
		sort: options.sort,
		limit: options.limit,
		offset: options.offset
	};
	return unwrap(api.catalog.GET('/api/v1/catalog/search', { params: { query } }));
}

/** Имя человека для плашки фильтра: в адресе только slug; не нашёлся — сам slug. */
export async function personName(api: Api, slug: string | undefined): Promise<string | null> {
	if (!slug) return null;
	try {
		const person = await unwrap(
			api.catalog.GET('/api/v1/catalog/people/{slug}', { params: { path: { slug } } })
		);
		return person.full_name;
	} catch {
		return slug;
	}
}

/** Порция выдачи раздела (/films): одна функция и для load, и для «Показать ещё» в браузере. */
export function sectionPage(
	api: Api,
	kind: SchemaEntityKind,
	f: CatalogFilters,
	mode: Mode,
	offset: number
) {
	return searchPage(api, f, { kind, sort: searchSortParam(mode.sort), limit: PAGE_SIZE, offset });
}

/** Просто список без текста (главная, тег, студия): страница поиска с одним-двумя фильтрами. */
export function listPage(
	api: Api,
	f: Pick<CatalogFilters, 'tag'>,
	options: {
		kind?: SchemaEntityKind | readonly SchemaEntityKind[];
		studioSlug?: string;
		sort: SchemaSearchSort;
		limit: number;
		offset?: number;
	}
) {
	return searchPage(api, f, { offset: 0, ...options });
}

/** Порция архива по названию (архив — Tantivy, только по названию); limit — не больше 20. */
export function archivePage(api: Api, q: string, limit: number, offset = 0) {
	return unwrap(
		api.catalog.GET('/api/v1/catalog/archive/search', { params: { query: { q, limit, offset } } })
	);
}

/**
 * Сколько фильмов в архиве (не на сайте, ищутся только по названию). null — архив недоступен (503)
 * или ответ не пришёл: подпись про архив тогда просто не показываем. Пути ещё нет в контракте
 * catalog.json — поэтому обычный fetch.
 */
export async function archiveMovies(fetch: typeof globalThis.fetch, origin: string) {
	try {
		const res = await fetch(`${origin}/api/v1/catalog/archive/stats`);
		if (!res.ok) return null;
		const stats: { by_kind?: Record<string, number> } = await res.json();
		return stats.by_kind?.movie ?? null;
	} catch {
		return null;
	}
}
