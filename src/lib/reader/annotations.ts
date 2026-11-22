// Закладки и выделения в читалке: личные, по API (/books/{slug}/annotations, /annotations/{id},
// /users/me/annotations). Страница книги статическая — всё это грузится в браузере после входа.
import type { Api } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import type {
	SchemaAnnotation,
	SchemaAnnotationKind,
	SchemaPageAnnotationWithEntity
} from '#lib/api/generated/social.ts';

export type Annotation = SchemaAnnotation;
/** Пометка в своём списке (профиль): та же плюс книга. */
export type AnnotationWithEntity = SchemaPageAnnotationWithEntity['items'][number];
export type AnnotationKind = SchemaAnnotationKind;

/**
 * Семь цветов выделения (индекс — `color` в API, 0–6). Полупрозрачные: текст под ними читается
 * и на светлой, и на тёмной теме читалки.
 */
export const HIGHLIGHT_COLORS = [
	{ name: 'Жёлтый', hex: '#f5d90a' },
	{ name: 'Зелёный', hex: '#4ade80' },
	{ name: 'Голубой', hex: '#38bdf8' },
	{ name: 'Розовый', hex: '#f472b6' },
	{ name: 'Оранжевый', hex: '#fb923c' },
	{ name: 'Фиолетовый', hex: '#a78bfa' },
	{ name: 'Красный', hex: '#f87171' }
] as const;

export const colorHex = (color: number | null | undefined) =>
	HIGHLIGHT_COLORS[color ?? 0]?.hex ?? HIGHLIGHT_COLORS[0].hex;

export const listBook = (api: Api, slug: string) =>
	unwrap(api.social.GET('/api/v1/social/books/{slug}/annotations', { params: { path: { slug } } }));

export interface NewAnnotation {
	kind: AnnotationKind;
	cfi: string;
	text?: string | null;
	color?: number | null;
	note?: string | null;
	chapter?: string | null;
	fraction?: number | null;
}

export const create = (api: Api, slug: string, body: NewAnnotation) =>
	unwrap(
		api.social.POST('/api/v1/social/books/{slug}/annotations', {
			params: { path: { slug } },
			body
		})
	);

/** note: undefined — не менять, null или '' — убрать. */
export const update = (api: Api, id: string, body: { color?: number; note?: string | null }) =>
	unwrap(api.social.PATCH('/api/v1/social/annotations/{id}', { params: { path: { id } }, body }));

export const remove = (api: Api, id: string) =>
	unwrap(api.social.DELETE('/api/v1/social/annotations/{id}', { params: { path: { id } } }));

export const listOwn = (
	api: Api,
	query: { kind?: AnnotationKind; limit?: number; offset?: number } = {}
) => unwrap(api.social.GET('/api/v1/social/users/me/annotations', { params: { query } }));

/** Ссылка, открывающая читалку на месте пометки. */
export const readHref = (slug: string, cfi: string) =>
	`/books/${slug}/read?at=${encodeURIComponent(cfi)}`;

/** Пометки книги по порядку в книге: по доле прочитанного, без неё — в конце. */
export function inBookOrder<T extends Pick<Annotation, 'fraction' | 'created_at'>>(list: T[]): T[] {
	return list.toSorted(
		(a, b) => (a.fraction ?? 2) - (b.fraction ?? 2) || a.created_at.localeCompare(b.created_at)
	);
}
