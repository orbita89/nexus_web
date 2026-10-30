// Фильтры раздела каталога (/films): всё состояние — в адресе, чтобы ссылкой можно было
// поделиться.
//
//   /films?q=дюна&studio=Warner%20Bros.%20Pictures&person=christopher-nolan&role=director
//         &tag=drama&year_from=2000&year_to=2010&archive=1&sort=new
//
// Выдача всегда из Meilisearch (GET /search): быстро и без PostgreSQL. С текстом — по
// релевантности, без него — «Рекомендуемые». Жанр — тоже тег (kind = genre): фильтр один, `tag`. Год — либо ровно (`year`), либо период
// (`year_from` / `year_to`, можно одну границу). Архив — фильмы GET /archive/search за фильмами
// сайта в той же выдаче, только по названию (без названия и фильтров — весь архив); выключен по
// умолчанию, включённый — archive=1. Его читает страница (readArchive), не load: переключатель не
// перезапрашивает выдачу сайта.
import type { SchemaEntityKind, SchemaSearchSort } from '#lib/api/generated/catalog.ts';
import { DEFAULT_SORT, LIST_SORTS } from './sort.ts';
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
	{ value: 'editor', title: 'Монтажёр' },
	{ value: 'author', title: 'Автор' },
	{ value: 'translator', title: 'Переводчик' },
	{ value: 'illustrator', title: 'Иллюстратор' }
] as const;

export type PersonRole = (typeof PERSON_ROLES)[number]['value'];

/**
 * Набор фильтров раздела: он свой у каждого типа. У книг нет студии (её место — издательство), у
 * игр нет титров, а роль по умолчанию у фильма и книги разная: «Актёр» против «Автора».
 */
export interface FilterSet {
	/** Роли в выпадающем списке; пустой список — поля «Человек» в разделе нет. */
	roles: readonly PersonRole[];
	/** Роль, выбранная заранее: по ней ищут чаще всего. Пустая — любая. */
	defaultRole: PersonRole;
	/** Студия производства (`metadata.studios`, страница студии). */
	studio: boolean;
	/** Издатель: издательство книги, издатель или разработчик игры. `null` — поля нет. */
	publisherLabel: string | null;
	/** «Архив» — холодный архив фильмов. */
	archive: boolean;
}

const FILM_ROLES = [
	'actor',
	'director',
	'writer',
	'producer',
	'composer',
	'cinematographer',
	'editor'
] as const satisfies readonly PersonRole[];

const SETS: Record<SchemaEntityKind, FilterSet> = {
	movie: {
		roles: FILM_ROLES,
		defaultRole: 'actor',
		studio: true,
		publisherLabel: null,
		archive: true
	},
	series: {
		roles: FILM_ROLES,
		defaultRole: 'actor',
		studio: true,
		publisherLabel: null,
		archive: false
	},
	book: {
		roles: ['author', 'translator', 'illustrator'],
		defaultRole: 'author',
		studio: false,
		publisherLabel: 'Издательство',
		archive: false
	},
	game: {
		// Титров у игр нет, поэтому нет и поля «Человек»; студию заменяют издатель и разработчик.
		roles: [],
		defaultRole: '',
		studio: false,
		publisherLabel: 'Издатель или разработчик',
		archive: false
	}
};

/** Общая страница поиска (`/search`): раздел не выбран — показываем всё и без умолчаний. */
const ALL: FilterSet = {
	roles: [...FILM_ROLES, 'author', 'translator', 'illustrator'],
	defaultRole: '',
	studio: true,
	publisherLabel: 'Издатель',
	archive: true
};

/** Набор фильтров раздела; без раздела (общий поиск) — все поля. */
export function filterSet(kind?: SchemaEntityKind): FilterSet {
	return kind ? SETS[kind] : ALL;
}

/** Роли выпадающего списка раздела: первой всегда «Любая роль». */
export function roleOptions(set: FilterSet) {
	return PERSON_ROLES.filter((r) => !r.value || set.roles.includes(r.value));
}

/** Порядок поиска: «по релевантности» — когда sort не передан. */
export type SearchSort = SchemaSearchSort | 'relevance';

/** С текстом в запросе — ещё «По релевантности» (по умолчанию). */
export const SEARCH_SORTS: readonly { value: SearchSort; title: string }[] = [
	{ value: 'relevance', title: 'По релевантности' },
	...LIST_SORTS
];

export interface CatalogFilters {
	q?: string;
	/** Slug тега или жанра. */
	tag?: string;
	/** Ровно этот год; с периодом не бывает. */
	year?: number;
	yearFrom?: number;
	yearTo?: number;
	/** Точное название студии (из подсказок GET /search/studios). */
	studio?: string;
	/** Точное название издателя: издательство книги, издатель или разработчик игры. */
	publisher?: string;
	/** Slug человека. */
	person?: string;
	/** Роль человека; без person не используется. */
	role?: string;
	/** Slug премии: работы с её наградой или номинацией. */
	award?: string;
	/** Год церемонии; без award не используется. */
	awardYear?: number;
	/** Только с полученной наградой (не номинацией). */
	awarded?: boolean;
}

export function readFilters(url: UrlLike): CatalogFilters {
	const person = readText(url, 'person');
	const award = readText(url, 'award');
	const role = readText(url, 'role');
	const yearFrom = readYear(url, 'year_from');
	const yearTo = readYear(url, 'year_to');
	const range = yearFrom !== undefined || yearTo !== undefined;
	return {
		q: readText(url, 'q'),
		tag: readText(url, 'tag'),
		// Период важнее: вместе бэкенд ответил бы 400.
		year: range ? undefined : readYear(url),
		yearFrom,
		yearTo,
		studio: readText(url, 'studio'),
		publisher: readText(url, 'publisher'),
		person,
		role: person && PERSON_ROLES.some((r) => r.value === role) ? role : undefined,
		award,
		awardYear: award ? readYear(url, 'award_year') : undefined,
		awarded: url.searchParams.get('awarded') === '1' || undefined
	};
}

/**
 * «Архив» (archive=1): фильмы архива за фильмами сайта. По умолчанию выключен. Только для
 * страницы, не для load: иначе переключатель перезапрашивал бы выдачу сайта.
 */
export function readArchive(url: UrlLike): boolean {
	return url.searchParams.get('archive') === '1';
}

/** Активен хоть один фильтр — показываем «Сбросить». Архив не фильтр: он только добавляет фильмы. */
export function hasFilters(f: CatalogFilters): boolean {
	return !!(
		f.q ||
		f.tag ||
		f.year ||
		f.yearFrom ||
		f.yearTo ||
		f.studio ||
		f.person ||
		f.award ||
		f.awarded
	);
}

/** Порядок выдачи: с текстом — по релевантности или любой из списка, без текста — из списка. */
export interface Mode {
	sort: SearchSort;
	options: readonly { value: SearchSort; title: string }[];
	/** Порядок по умолчанию: в адрес не пишется. */
	fallback: SearchSort;
}

/** Порядок из ?sort=; не подходящий режиму (релевантность без текста) — умолчание режима. */
export function readMode(url: UrlLike, f: CatalogFilters): Mode {
	const raw = url.searchParams.get('sort');
	const text = !!f.q;
	const options = text ? SEARCH_SORTS : LIST_SORTS;
	const fallback = text ? 'relevance' : DEFAULT_SORT;
	const sort = options.find((s) => s.value === raw)?.value ?? fallback;
	return { sort, options, fallback };
}

/** Значение sort для API поиска: релевантность — без параметра. */
export function searchSortParam(sort: SearchSort): SchemaSearchSort | undefined {
	return sort === 'relevance' ? undefined : sort;
}

/** Подпись года для плашки: «2014», «2000–2010», «с 2000», «до 2010». */
export function yearLabel(f: Pick<CatalogFilters, 'year' | 'yearFrom' | 'yearTo'>): string | null {
	if (f.year) return String(f.year);
	if (f.yearFrom && f.yearTo) return `${f.yearFrom}–${f.yearTo}`;
	if (f.yearFrom) return `с ${f.yearFrom}`;
	if (f.yearTo) return `до ${f.yearTo}`;
	return null;
}
