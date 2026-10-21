// Коллекции: проверка форм и перестановка пунктов. Порядок сохраняется целиком
// (PUT /collections/{id}/items: все slug'и ровно по разу).

import type { Api } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import type {
	SchemaCollection,
	SchemaCollectionBySlug,
	SchemaCollectionDetail,
	SchemaCollectionItem,
	SchemaFeatureCollection,
	SchemaPutCollectionItem
} from '#lib/api/generated/social.ts';

export const COLLECTION_LIMITS = { title: 200, description: 2000, note: 1000, items: 500 };

/** Проверка формы коллекции — правила бэкенда; null — всё в порядке. */
export function collectionFormError(form: { title: string; description: string }): string | null {
	const title = form.title.trim();
	if (!title) return 'Введите название.';
	if (title.length > COLLECTION_LIMITS.title) return 'Название — не длиннее 200 символов.';
	if (form.description.trim().length > COLLECTION_LIMITS.description) {
		return 'Описание — не длиннее 2000 символов.';
	}
	return null;
}

/** Переставить элемент: с позиции from на позицию to (новый массив). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
	if (from === to || from < 0 || from >= list.length) return [...list];
	const next = [...list];
	const [item] = next.splice(from, 1);
	next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
	return next;
}

// Особые коллекции («Подборки»): список для главной и пометка админом.

/** Особые коллекции по порядку (featured_position), без пагинации. Доступно гостю. */
export function getFeaturedCollections(api: Api): Promise<SchemaCollection[]> {
	return unwrap(api.social.GET('/api/v1/social/collections/featured'));
}

/** Новые публичные коллекции (страница limit/offset). */
export function listPublicCollections(
	api: Api,
	offset = 0,
	limit = 20
): Promise<SchemaCollection[]> {
	return unwrap(
		api.social.GET('/api/v1/social/collections', { params: { query: { offset, limit } } })
	).then((page) => page.items);
}

/** Особая коллекция по slug: сама коллекция, либо куда перенаправить. 404 — ApiError. */
export function getCollectionBySlug(api: Api, slug: string): Promise<SchemaCollectionBySlug> {
	return unwrap(
		api.social.GET('/api/v1/social/collections/by-slug/{slug}', { params: { path: { slug } } })
	);
}

/** Ответ by-slug — сама коллекция (а не перенаправление). */
export function isCollectionDetail(r: SchemaCollectionBySlug): r is SchemaCollectionDetail {
	return 'id' in r;
}

export type FeaturedOptions = SchemaFeatureCollection;

/**
 * Админ: сделать коллекцию особой, поменять позицию, адрес (slug) и/или оформление
 * (wallpaper_url, cover_url, theme, wallpaper_mode, wallpaper_dim, wallpaper_blur, effects,
 * accent_color). Не передано — не меняется, null — убрать.
 * Приватная → 400 collection_private, неверное поле → 400 validation (field), slug занят → 409.
 */
export function adminSetFeatured(
	api: Api,
	id: string,
	opts: FeaturedOptions = {}
): Promise<SchemaCollection> {
	const body = Object.fromEntries(
		Object.entries(opts).filter(([, v]) => v !== undefined)
	) as FeaturedOptions;
	return unwrap(
		api.social.PUT('/api/v1/social/admin/collections/{id}/featured', {
			params: { path: { id } },
			body
		})
	);
}

/** Админ: убрать коллекцию из особых (204). */
export async function adminUnsetFeatured(api: Api, id: string): Promise<void> {
	await unwrap(
		api.social.DELETE('/api/v1/social/admin/collections/{id}/featured', {
			params: { path: { id } }
		})
	);
}

/** Бэкенд отказал, потому что особая коллекция должна быть публичной. */
export function isFeaturedMustBePublic(e: unknown): boolean {
	return e instanceof ApiError && e.code === 'collection_private';
}

export const FEATURED_PRIVATE_ERROR =
	'Особую коллекцию нельзя сделать приватной — сначала уберите её из подборок';

/** «Топ» — если название похоже на рейтинг («Топ-10», «Top 100», «Лучшие …»), иначе «Подборка редакции». */
export function featuredBadge(title: string): string {
	return /(^|[^\p{L}])(топ|top)([^\p{L}]|$)|лучш/iu.test(title) ? 'Топ' : 'Подборка редакции';
}

/** Понятный текст ошибки админских действий с подборками и их составом. */
export function featuredAdminError(e: unknown, fallback: (e: unknown) => string): string {
	if (e instanceof ApiError) {
		if (e.status === 403) return 'Недостаточно прав.';
		if (e.status === 409) return 'Такой адрес уже занят.';
		if (e.code === 'collection_private') return 'Сначала сделайте коллекцию публичной.';
		if (e.code === 'not_featured') return 'Коллекция не особая.';
		if (e.status === 404) return 'Коллекция не найдена.';
		if (e.status === 400) return `Не удалось сохранить: ${e.serverMessage ?? e.message}`;
	}
	return fallback(e);
}

/** Поле, на которое указал бэкенд в 400 validation (slug, wallpaper_url, cover_url, theme,
 * wallpaper_mode, wallpaper_dim, wallpaper_blur, effects, accent_color). */
export function validationField(e: unknown): string | null {
	return e instanceof ApiError && e.code === 'validation' ? e.field : null;
}

// Состав коллекции. Владелец — обычные пути; админ в чужой особой — /admin/collections/{id}/items/{slug}.

/** Править чужую особую коллекцию через админские пути (владелец — через свои). */
export function editsAsAdmin(
	collection: Pick<SchemaCollection, 'is_featured' | 'owner'>,
	viewer: { id: string; role?: string } | null | undefined
): boolean {
	return (
		!!viewer &&
		viewer.role === 'admin' &&
		collection.is_featured &&
		viewer.id !== collection.owner.id
	);
}

/** Добавить произведение или изменить пункт (заметка, позиция). */
export function putCollectionItem(
	api: Api,
	id: string,
	slug: string,
	body: SchemaPutCollectionItem,
	asAdmin: boolean
): Promise<SchemaCollectionItem> {
	const params = { path: { id, slug } };
	return unwrap(
		asAdmin
			? api.social.PUT('/api/v1/social/admin/collections/{id}/items/{slug}', { params, body })
			: api.social.PUT('/api/v1/social/collections/{id}/items/{slug}', { params, body })
	);
}

/** Убрать произведение из коллекции. */
export async function deleteCollectionItem(
	api: Api,
	id: string,
	slug: string,
	asAdmin: boolean
): Promise<void> {
	const params = { path: { id, slug } };
	await unwrap(
		asAdmin
			? api.social.DELETE('/api/v1/social/admin/collections/{id}/items/{slug}', { params })
			: api.social.DELETE('/api/v1/social/collections/{id}/items/{slug}', { params })
	);
}

// Название и описание. Владелец — PATCH /collections/{id}, админ — PATCH /admin/collections/{id}.

/** Изменить название и описание (пустое описание — null). Только владелец. */
export function updateCollectionText(
	api: Api,
	id: string,
	form: { title: string; description: string }
): Promise<SchemaCollectionDetail> {
	return unwrap(
		api.social.PATCH('/api/v1/social/collections/{id}', {
			params: { path: { id } },
			body: { title: form.title.trim(), description: form.description.trim() || null }
		})
	);
}

/** Админ: изменить название и описание чужой коллекции (пустое описание — null). */
export function adminUpdateCollection(
	api: Api,
	id: string,
	form: { title: string; description: string }
): Promise<SchemaCollection> {
	return unwrap(
		api.social.PATCH('/api/v1/social/admin/collections/{id}', {
			params: { path: { id } },
			body: { title: form.title.trim(), description: form.description.trim() || null }
		})
	);
}

/** Понятный текст ошибки правки названия/описания. */
export function collectionTextError(e: unknown, fallback: (e: unknown) => string): string {
	if (e instanceof ApiError) {
		if (e.status === 403) return 'Недостаточно прав.';
		if (e.status === 404) return 'Коллекция не найдена.';
		if (e.code === 'validation' && e.field === 'title') return 'Неверное название — проверьте.';
		if (e.code === 'validation' && e.field === 'description')
			return 'Неверное описание — проверьте.';
	}
	return fallback(e);
}
