// Выдача поиска Meilisearch (GET /search) с фильтрами из адреса — для разделов (/films) и
// общей страницы /search.
import type { Api } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import type { SchemaEntityKind, SchemaSearchSort } from '#lib/api/generated/catalog.ts';
import { searchSortParam, type CatalogFilters, type Mode } from './filters.ts';
import { PAGE_SIZE } from './url.ts';

/**
 * Страница поиска. Фильтр по людям на бэкенде пока заглушка (503 `person_filter_unavailable`):
 * тогда ищем по остальным фильтрам и сообщаем это флагом personUnavailable — страница пишет
 * «скоро заработает», а не ошибку.
 */
export async function searchPage(
	api: Api,
	f: CatalogFilters,
	options: { kind?: SchemaEntityKind; sort?: SchemaSearchSort; limit: number; offset: number }
) {
	const query = {
		kind: options.kind,
		q: f.q,
		tag: f.tag,
		year: f.year,
		year_from: f.yearFrom,
		year_to: f.yearTo,
		studio: f.studio,
		person: f.person,
		role: f.person ? f.role : undefined,
		sort: options.sort,
		limit: options.limit,
		offset: options.offset
	};
	const search = (q: typeof query) =>
		unwrap(api.catalog.GET('/api/v1/catalog/search', { params: { query: q } }));
	try {
		return { page: await search(query), personUnavailable: false };
	} catch (e) {
		if (!(f.person && e instanceof ApiError && e.code === 'person_filter_unavailable')) throw e;
		const rest = { ...query, person: undefined, role: undefined };
		return { page: await search(rest), personUnavailable: true };
	}
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

/**
 * Порция выдачи раздела (/films): текст, студия, человек, период — поиск Meilisearch, иначе —
 * список GET /entities. Одна функция и для load, и для «Показать ещё» в браузере.
 */
export async function sectionPage(
	api: Api,
	kind: SchemaEntityKind,
	f: CatalogFilters,
	mode: Mode,
	offset: number
) {
	const page = { limit: PAGE_SIZE, offset };
	if (!mode.search) {
		const query = { kind, tag: f.tag, year: f.year, sort: mode.sort, ...page };
		return {
			page: await unwrap(api.catalog.GET('/api/v1/catalog/entities', { params: { query } })),
			personUnavailable: false
		};
	}
	return searchPage(api, f, { kind, sort: searchSortParam(mode.sort), ...page });
}
