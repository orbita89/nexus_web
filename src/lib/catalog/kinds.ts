import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';

/** Разделы каталога: адрес в URL ↔ тип сущности в API. */
export const KINDS = [
	{ slug: 'films', kind: 'movie', title: 'Фильмы', one: 'Фильм' },
	{ slug: 'series', kind: 'series', title: 'Сериалы', one: 'Сериал' },
	{ slug: 'books', kind: 'book', title: 'Книги', one: 'Книга' },
	{ slug: 'games', kind: 'game', title: 'Игры', one: 'Игра' }
] as const satisfies readonly {
	slug: string;
	kind: SchemaEntityKind;
	/** Раздел во множественном числе. */
	title: string;
	/** Один элемент: подпись в выдаче поиска. */
	one: string;
}[];

export type KindSlug = (typeof KINDS)[number]['slug'];

export function kindBySlug(slug: string) {
	return KINDS.find((k) => k.slug === slug);
}

export function kindByApi(kind: SchemaEntityKind) {
	return KINDS.find((k) => k.kind === kind)!;
}

/** Адрес карточки: /films/dune-2021. */
export function entityHref(entity: { kind: SchemaEntityKind; slug: string }) {
	return `/${kindByApi(entity.kind).slug}/${entity.slug}`;
}

/** Адрес карточки по ссылке из social (EntityRef.kind там — строка); неизвестный тип — null. */
export function refHref(ref: { kind: string; slug: string }): string | null {
	const kind = KINDS.find((k) => k.kind === ref.kind)?.kind;
	return kind ? entityHref({ kind, slug: ref.slug }) : null;
}
