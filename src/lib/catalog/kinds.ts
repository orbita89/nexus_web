import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';

/** Разделы каталога: адрес в URL ↔ тип сущности в API. */
export const KINDS = [
	{ slug: 'films', kind: 'movie', title: 'Фильмы' },
	{ slug: 'series', kind: 'series', title: 'Сериалы' },
	{ slug: 'books', kind: 'book', title: 'Книги' },
	{ slug: 'games', kind: 'game', title: 'Игры' }
] as const satisfies readonly { slug: string; kind: SchemaEntityKind; title: string }[];

export type KindSlug = (typeof KINDS)[number]['slug'];

export function kindBySlug(slug: string) {
	return KINDS.find((k) => k.slug === slug);
}

export function kindByApi(kind: SchemaEntityKind) {
	return KINDS.find((k) => k.kind === kind)!;
}
