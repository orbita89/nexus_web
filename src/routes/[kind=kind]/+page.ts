import { publicApi, type Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import {
	readFilters,
	readMode,
	searchSortParam,
	type CatalogFilters,
	type Mode
} from '#lib/catalog/filters.ts';
import { kindBySlug } from '#lib/catalog/kinds.ts';
import { ratingsFor, settle } from '#lib/catalog/load.ts';
import { personName, searchPage } from '#lib/catalog/search.ts';
import { PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
import type { PageLoad } from './$types';

/** Архивных фильмов в первой порции; дальше — «Показать ещё» в браузере. */
export const _ARCHIVE_PAGE = 12;

// /films?q=дюна&studio=…&person=…&role=actor&tag=…&year=2014&archive=0&sort=new&offset=24 —
// всё состояние выдачи в адресе (filters.ts). Текст, студия, человек — поиск Meilisearch;
// без них — обычный список. Архив — параллельно, только по названию и только у фильмов.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const kind = kindBySlug(params.kind)!;
	const filters = readFilters(url);
	const mode = readMode(url, filters);
	const offset = readOffset(url);
	const api = publicApi(fetch, url);
	const archiveOn = filters.archive && kind.kind === 'movie' && !!filters.q;

	const [results, tags, person, archive] = await Promise.all([
		settle(list(api, kind.kind, filters, mode, offset)),
		settle(unwrap(api.catalog.GET('/api/v1/catalog/tags'))),
		personName(api, filters.person),
		archiveOn
			? settle(
					unwrap(
						api.catalog.GET('/api/v1/catalog/archive/search', {
							params: { query: { q: filters.q!, limit: _ARCHIVE_PAGE } }
						})
					)
				)
			: null
	]);
	const items = results.data?.page.items ?? [];
	const ratings = await ratingsFor(api, items);
	return {
		kind,
		filters,
		mode,
		ratings,
		list: results.data
			? { data: results.data.page, error: null }
			: { data: null, error: results.error },
		/** Фильтр по людям ещё не готов на бэкенде — показали выдачу без него. */
		personUnavailable: results.data?.personUnavailable ?? false,
		personName: person,
		archive,
		tags: (tags.data ?? []).toSorted((a, b) => a.name.localeCompare(b.name, 'ru'))
	};
};

async function list(
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
