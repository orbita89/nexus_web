import { publicApi } from '#lib/api/client.ts';
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import type { SchemaPersonHit } from '#lib/api/generated/catalog.ts';
import { hasFilters, readFilters } from '#lib/catalog/filters.ts';
import { kindBySlug } from '#lib/catalog/kinds.ts';
import { ratingsFor, settle, type Ratings } from '#lib/catalog/load.ts';
import { personName, searchPage } from '#lib/catalog/search.ts';
import { PAGE_SIZE, readOffset, readText } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

/** Архивных фильмов за порцию (у архива limit не больше 20); дальше — «Показать ещё». */
export const _ARCHIVE_PAGE = 20;
/** Людей в блоке над фильмами; все — на /people?q=. */
const PEOPLE_SHOWN = 6;

// /search?q=дюна&kind=films&studio=…&tag=drama&year_from=2000&archive=0&offset=24 — поиск через
// Meilisearch, фильтры те же, что в разделах (filters.ts). Параллельно с фильмами — люди (только по
// тексту, без фильтров фильмов) и архив (только по названию, если не выключен). Их ошибки не
// ломают выдачу: блока просто нет.
export const load: PageLoad = async ({ fetch, url }) => {
	const filters = readFilters(url);
	const q = filters.q;
	const kind = kindBySlug(readText(url, 'kind') ?? '');
	const api = publicApi(fetch, url);
	const none: Ratings = {};
	const tagsCall = settle(unwrap(api.catalog.GET('/api/v1/catalog/tags')));
	const blank = {
		q,
		kind,
		filters,
		personUnavailable: false,
		result: null,
		ratings: none,
		people: [] as SchemaPersonHit[],
		archive: null,
		unavailable: false,
		error: null as string | null
	};
	// Ни запроса, ни фильтров — подсказка, а не вся база.
	if (!hasFilters(filters)) {
		return { ...blank, tags: (await tagsCall).data ?? [], personName: null };
	}

	const offset = readOffset(url);
	const onlyText = !!q && !(filters.tag || filters.year || filters.yearFrom || filters.yearTo);
	const wantPeople = onlyText && !kind && !filters.studio && !filters.person && offset === 0;
	const wantArchive = !!q && filters.archive && (!kind || kind.kind === 'movie');

	const [found, tags, person, people, archive] = await Promise.all([
		searchPage(api, filters, { kind: kind?.kind, limit: PAGE_SIZE, offset }).then(
			(r) => ({ ...r, error: null }),
			(e: unknown) => ({ page: null, personUnavailable: false, error: e })
		),
		tagsCall,
		personName(api, filters.person),
		wantPeople
			? unwrap(
					api.catalog.GET('/api/v1/catalog/search/people', {
						params: { query: { q, limit: PEOPLE_SHOWN } }
					})
				).then(
					(r) => r.items,
					() => []
				)
			: [],
		wantArchive
			? settle(
					unwrap(
						api.catalog.GET('/api/v1/catalog/archive/search', {
							params: { query: { q: q!, limit: _ARCHIVE_PAGE } }
						})
					)
				)
			: null
	]);
	const base = { ...blank, tags: tags.data ?? [], personName: person, people, archive };
	if (!found.page) {
		// 503 — Meilisearch недоступен; остальной каталог при этом работает.
		const unavailable = found.error instanceof ApiError && found.error.status === 503;
		return { ...base, unavailable, error: unavailable ? null : errorMessage(found.error) };
	}
	return {
		...base,
		result: found.page,
		personUnavailable: found.personUnavailable,
		ratings: await ratingsFor(api, found.page.items)
	};
};
