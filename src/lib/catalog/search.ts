// Списки каталога — из Meilisearch (GET /search): разделы (/films), общая страница /search,
// главная, теги, студии. В PostgreSQL (GET /entities) за списками не ходим: там сортировка всего
// каталога бывает по 7 с, у Meilisearch — десятки миллисекунд.
import type { Api } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import type { SchemaEntityKind, SchemaSearchSort } from '#lib/api/generated/catalog.ts';
import { searchSortParam, type CatalogFilters, type Mode } from './filters.ts';
import { count } from './labels.ts';
import { PAGE_SIZE } from './url.ts';

/**
 * Дальше этого Meilisearch не считает и не листает (`pagination.maxTotalHits`, по умолчанию 1000;
 * docs/backend-questions.md): total ровно столько — найдено больше.
 */
export const SEARCH_MAX_TOTAL = 1000;

/**
 * Подпись числа найденного: «Больше 1 000 фильмов» на потолке Meilisearch, «Около 25 фильмов» —
 * оценка поиска по тексту, иначе просто число. extra — сколько ещё нашлось в архиве.
 */
export function foundLabel(
	total: number,
	forms: readonly [string, string, string],
	options: { text?: boolean; limit?: number; extra?: number } = {}
): string {
	const n = count(total + (options.extra ?? 0), forms);
	if (total === SEARCH_MAX_TOTAL) return `Больше ${n}`;
	return options.text && total > (options.limit ?? 0) ? `Около ${n}` : n;
}

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
export async function listPage(
	api: Api,
	f: Pick<CatalogFilters, 'tag' | 'studio'>,
	options: { kind?: SchemaEntityKind; sort: SchemaSearchSort; limit: number; offset?: number }
) {
	const { page } = await searchPage(api, f, { offset: 0, ...options });
	return page;
}

/**
 * «Запрос» всего архива: `*` в синтаксисе Tantivy — все документы, выше популярные. Отдельного
 * списка и счётчика у архива в API нет, а этот запрос считает миллион документов 1,5–2 с — только
 * в браузере, страница его не ждёт (docs/backend-questions.md).
 */
export const ARCHIVE_ALL = '*';

/** Порция архива по названию (или ARCHIVE_ALL); limit у архива — не больше 20. */
export function archivePage(api: Api, q: string, limit: number, offset = 0) {
	return unwrap(
		api.catalog.GET('/api/v1/catalog/archive/search', { params: { query: { q, limit, offset } } })
	);
}
