import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';

/** Формы для счётчиков: одна, две, пять. */
export type Words = readonly [string, string, string];

const FILMS: Words = ['фильм', 'фильма', 'фильмов'];
const SERIES: Words = ['сериал', 'сериала', 'сериалов'];
const BOOKS: Words = ['книга', 'книги', 'книг'];
const GAMES: Words = ['игра', 'игры', 'игр'];
const PAINTINGS: Words = ['картина', 'картины', 'картин'];
/** Раздел не выбран (общий поиск, несколько типов разом). */
const WORKS: Words = ['работа', 'работы', 'работ'];

/** Слова счётчика раздела: без раздела — нейтральные «работы». */
export function kindWords(kind?: SchemaEntityKind): Words {
	return KINDS.find((k) => k.kind === kind)?.words ?? WORKS;
}

/** Разделы каталога: адрес в URL ↔ тип сущности в API. */
export const KINDS = [
	{ slug: 'films', kind: 'movie', title: 'Фильмы', one: 'Фильм', words: FILMS },
	{ slug: 'series', kind: 'series', title: 'Сериалы', one: 'Сериал', words: SERIES },
	{ slug: 'books', kind: 'book', title: 'Книги', one: 'Книга', words: BOOKS },
	{ slug: 'games', kind: 'game', title: 'Игры', one: 'Игра', words: GAMES },
	{ slug: 'paintings', kind: 'painting', title: 'Картины', one: 'Картина', words: PAINTINGS }
] as const satisfies readonly {
	slug: string;
	kind: SchemaEntityKind;
	/** Раздел во множественном числе. */
	title: string;
	/** Один элемент: подпись в выдаче поиска. */
	one: string;
	/** Счётчики: «1 картина», «2 картины», «100 картин». */
	words: Words;
}[];

export type KindSlug = (typeof KINDS)[number]['slug'];

export function kindBySlug(slug: string) {
	return KINDS.find((k) => k.slug === slug);
}

/** Разделы из адреса: `kind=films,games` (несколько типов — ИЛИ). Мусор отбрасываем. */
export function kindsBySlugs(param: string | undefined) {
	const slugs = (param ?? '').split(',');
	return KINDS.filter((k) => slugs.includes(k.slug));
}

/** Обратно в адрес: пусто — параметра нет (значит, везде). */
export function kindsParam(kinds: readonly { slug: string }[]): string | null {
	return kinds.length ? kinds.map((k) => k.slug).join(',') : null;
}

/**
 * Сезон — не раздел каталога: своей выдачи у него нет, он живёт внутри «Сериалов» (в поиске
 * сезоны не показываем — в списке должен быть «Аркейн», а не «Аркейн, сезон 1»). Поэтому везде,
 * где нужен раздел, сезон отвечает разделом сериалов.
 */
export function kindByApi(kind: SchemaEntityKind) {
	const api = kind === 'season' ? 'series' : kind;
	return KINDS.find((k) => k.kind === api)!;
}

/** Адрес карточки: /films/dune-2021, у сезона — /series/arcane/season-2. */
export function entityHref(entity: { kind: SchemaEntityKind; slug: string }) {
	if (entity.kind === 'season') {
		// Слаг сезона бэкенд собирает из сериала и номера; откуда ещё пришла ссылка на сезон
		// (лента активности, рецензия), сериала рядом нет — разбираем слаг.
		const parts = /^(.+)-season-(\d+)$/.exec(entity.slug);
		if (parts) return `/series/${parts[1]}/season-${parts[2]}`;
	}
	return `/${kindByApi(entity.kind).slug}/${entity.slug}`;
}

/** Адрес карточки по ссылке из social (EntityRef.kind там — строка); неизвестный тип — null. */
export function refHref(ref: { kind: string; slug: string }): string | null {
	const kind = asKind(ref.kind);
	return kind ? entityHref({ kind, slug: ref.slug }) : null;
}

/** Тип из ссылки social (строка) → тип каталога; неизвестный — null. */
export function asKind(kind: string): SchemaEntityKind | null {
	return KINDS.find((k) => k.kind === kind)?.kind ?? null;
}
