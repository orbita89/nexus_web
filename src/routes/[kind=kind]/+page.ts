import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import { readFilters, readMode } from '#lib/catalog/filters.ts';
import { kindBySlug } from '#lib/catalog/kinds.ts';
import { ratingsFor, settle } from '#lib/catalog/load.ts';
import { archiveMovies, personName, sectionPage } from '#lib/catalog/search.ts';
import { readOffset } from '#lib/catalog/url.ts';
import type { PageLoad } from './$types';

// /films?q=дюна&studio=…&person=…&role=actor&tag=…&year=2014&archive=1&sort=new&offset=24 —
// всё состояние выдачи в адресе (filters.ts). Текст, студия, человек — поиск Meilisearch;
// без них — обычный список. Архив (archive=1) здесь не читаем — его догружает страница
// (archive.svelte.ts), чтобы переключатель не перезапрашивал выдачу сайта.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const kind = kindBySlug(params.kind)!;
	const filters = readFilters(url);
	const mode = readMode(url, filters);
	const offset = readOffset(url);
	const api = publicApi(fetch, url);

	const [results, tags, person, archiveSize] = await Promise.all([
		settle(sectionPage(api, kind.kind, filters, mode, offset)),
		settle(unwrap(api.catalog.GET('/api/v1/catalog/tags'))),
		personName(api, filters.person),
		// Размер архива — для подписи «ещё N в архиве»; меняется только при пересборке архива.
		kind.kind === 'movie' ? archiveMovies(fetch, url.origin) : null
	]);
	const ratings = await ratingsFor(api, results.data?.items ?? []);
	return {
		kind,
		filters,
		mode,
		ratings,
		list: results,
		personName: person,
		archiveSize,
		tags: (tags.data ?? []).toSorted((a, b) => a.name.localeCompare(b.name, 'ru'))
	};
};
