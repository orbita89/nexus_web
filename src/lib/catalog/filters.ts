// Фильтры раздела каталога (/films): всё состояние — в адресе, чтобы ссылкой можно было
// поделиться.
//
//   /films?q=дюна&studio=Warner%20Bros.%20Pictures&person=christopher-nolan&role=director&archive=1&sort=new
//
// Текстовый поиск и фильтры по студии и людям — только через Meilisearch (GET /search). Без них
// раздел — просто список (GET /entities) с тегом, годом и своей сортировкой. Архив (archive=1) —
// отдельный блок под выдачей: GET /archive/search ищет только по названию.
import type { SchemaEntitySort, SchemaSearchSort } from '#lib/api/generated/catalog.ts';
import { DEFAULT_SORT, ENTITY_SORTS } from './sort.ts';
import { readText, readYear, type UrlLike } from './url.ts';

/** Роли для фильтра «Человек»; пустая — любая. */
export const PERSON_ROLES = [
	{ value: '', title: 'Любая роль' },
	{ value: 'actor', title: 'Актёр' },
	{ value: 'director', title: 'Режиссёр' },
	{ value: 'writer', title: 'Сценарист' },
	{ value: 'producer', title: 'Продюсер' },
	{ value: 'composer', title: 'Композитор' },
	{ value: 'cinematographer', title: 'Оператор' },
	{ value: 'editor', title: 'Монтажёр' }
] as const;

/** Порядок поиска: «по релевантности» — когда sort не передан. */
export type SearchSort = SchemaSearchSort | 'relevance';

export const SEARCH_SORTS: readonly { value: SearchSort; title: string }[] = [
	{ value: 'relevance', title: 'По релевантности' },
	{ value: 'recommended', title: 'Рекомендуемые' },
	{ value: 'new', title: 'Новые' },
	{ value: 'top_rated', title: 'Высокий рейтинг' },
	{ value: 'title', title: 'По названию' }
];

export interface CatalogFilters {
	q?: string;
	tag?: string;
	year?: number;
	/** Точное название студии (из подсказок GET /search/studios). */
	studio?: string;
	/** Slug человека. */
	person?: string;
	/** Роль человека; без person не используется. */
	role?: string;
	/** Искать и в архиве (только по названию). */
	archive: boolean;
}

export function readFilters(url: UrlLike): CatalogFilters {
	const person = readText(url, 'person');
	const role = readText(url, 'role');
	return {
		q: readText(url, 'q'),
		tag: readText(url, 'tag'),
		year: readYear(url),
		studio: readText(url, 'studio'),
		person,
		role: person && PERSON_ROLES.some((r) => r.value === role) ? role : undefined,
		archive: url.searchParams.get('archive') === '1'
	};
}

/** Нужен поиск Meilisearch: есть текст, студия или человек. */
export function isSearch(f: CatalogFilters): boolean {
	return !!(f.q || f.studio || f.person);
}

/** Активен хоть один фильтр или «в архиве» — показываем «Сбросить». */
export function hasFilters(f: CatalogFilters): boolean {
	return !!(f.q || f.tag || f.year || f.studio || f.person || f.archive);
}

export type Mode =
	| { search: true; sort: SearchSort; options: typeof SEARCH_SORTS; fallback: SearchSort }
	| {
			search: false;
			sort: SchemaEntitySort;
			options: typeof ENTITY_SORTS;
			fallback: SchemaEntitySort;
	  };

/**
 * Режим выдачи и порядок из ?sort=. У поиска свой набор: по умолчанию — по релевантности; порядок
 * списка, не подходящий поиску (и наоборот), — сбрасывается на умолчание режима.
 */
export function readMode(url: UrlLike, f: CatalogFilters): Mode {
	const raw = url.searchParams.get('sort');
	if (isSearch(f)) {
		const sort = SEARCH_SORTS.find((s) => s.value === raw)?.value ?? 'relevance';
		return { search: true, sort, options: SEARCH_SORTS, fallback: 'relevance' };
	}
	const sort = ENTITY_SORTS.find((s) => s.value === raw)?.value ?? DEFAULT_SORT;
	return { search: false, sort, options: ENTITY_SORTS, fallback: DEFAULT_SORT };
}

/** Значение sort для API поиска: релевантность — без параметра. */
export function searchSortParam(sort: SearchSort): SchemaSearchSort | undefined {
	return sort === 'relevance' ? undefined : sort;
}
