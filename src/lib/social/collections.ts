// Коллекции: проверка форм и перестановка пунктов. Порядок сохраняется целиком
// (PUT /collections/{id}/items: все slug'и ровно по разу).

import type { Api } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import type {
	SchemaCollection,
	SchemaCollectionBySlug,
	SchemaCollectionComment,
	SchemaCollectionDetail,
	SchemaCollectionItem,
	SchemaFeatureCollection,
	SchemaPageCollectionComment,
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

// Избранные подборки («Добавить в избранное»).
// TODO: бэкенд ещё не умеет — docs/backend-tasks/collection-saves-similar.md. После реализации:
// перегенерировать типы, включить флаг, убрать приведения типов ниже и в SaveCollectionButton.
export const SAVES_SUPPORTED = false;

/** `is_saved` из планируемого API (для гостя и до реализации — false). */
export function isSaved(collection: SchemaCollection): boolean {
	return (collection as SchemaCollection & { is_saved?: boolean }).is_saved === true;
}

/** Нет в сгенерированных типах, пока бэкенд не добавил эндпоинт: свободно типизированный вызов. */
type LooseCall = (
	path: string,
	init: { params: { path: { id: string } } }
) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
type LooseSocial = { PUT: LooseCall; DELETE: LooseCall };

/** PUT/DELETE /collections/{id}/save — идемпотентно, 204. */
export function setCollectionSaved(api: Api, id: string, saved: boolean): Promise<unknown> {
	const social = api.social as unknown as LooseSocial;
	const path = '/api/v1/social/collections/{id}/save';
	const init = { params: { path: { id } } };
	return unwrap(saved ? social.PUT(path, init) : social.DELETE(path, init));
}

// Обсуждение коллекции. Список плоский, старые сверху; ответы — с parent_id (ответ на ответ
// бэкенд привязывает к корню). Удаление корня убирает и ответы.

export const COMMENT_MAX = 2000;

/** Страница комментариев (limit 1–100, offset с 0). */
export function listCollectionComments(
	api: Api,
	id: string,
	page: { limit?: number; offset?: number } = {}
): Promise<SchemaPageCollectionComment> {
	return unwrap(
		api.social.GET('/api/v1/social/collections/{id}/comments', {
			params: { path: { id }, query: page }
		})
	);
}

/** Написать комментарий или ответ (parentId — id любого комментария этой коллекции). */
export function postCollectionComment(
	api: Api,
	id: string,
	body: string,
	parentId: string | null = null
): Promise<SchemaCollectionComment> {
	return unwrap(
		api.social.POST('/api/v1/social/collections/{id}/comments', {
			params: { path: { id } },
			body: { body: body.trim(), parent_id: parentId }
		})
	);
}

/** Удалить свой комментарий (204). */
export async function deleteCollectionComment(api: Api, commentId: string): Promise<void> {
	await unwrap(
		api.social.DELETE('/api/v1/social/collection-comments/{id}', {
			params: { path: { id: commentId } }
		})
	);
}

/** Админ: удалить любой комментарий (204). */
export async function adminDeleteCollectionComment(api: Api, commentId: string): Promise<void> {
	await unwrap(
		api.social.DELETE('/api/v1/social/admin/collection-comments/{id}', {
			params: { path: { id: commentId } }
		})
	);
}

/** Закрыть/открыть обсуждение: владелец — PATCH /collections/{id}, админ — /admin/collections/{id}. */
export function setCommentsLocked(
	api: Api,
	id: string,
	locked: boolean,
	asAdmin: boolean
): Promise<SchemaCollection> {
	const init = { params: { path: { id } }, body: { comments_locked: locked } };
	return unwrap(
		asAdmin
			? api.social.PATCH('/api/v1/social/admin/collections/{id}', init)
			: api.social.PATCH('/api/v1/social/collections/{id}', init)
	);
}

export const COMMENTS_LOCKED_ERROR = 'Обсуждение закрыто';

/** Бэкенд отказал: обсуждение закрыто. */
export function isCommentsLocked(e: unknown): boolean {
	return e instanceof ApiError && e.code === 'comments_locked';
}

/** Понятный текст ошибки комментариев (429 с Retry-After, закрытое обсуждение, валидация). */
export function collectionCommentError(e: unknown, fallback: (e: unknown) => string): string {
	if (e instanceof ApiError) {
		if (e.status === 429)
			return e.retryAfter != null
				? `Слишком часто. Попробуйте через ${Math.max(1, Math.ceil(e.retryAfter))} с.`
				: 'Слишком часто. Попробуйте чуть позже.';
		if (e.code === 'comments_locked') return COMMENTS_LOCKED_ERROR;
		if (e.status === 403) return 'Недостаточно прав.';
		if (e.status === 404) return 'Комментарий или коллекция не найдены.';
		if (e.code === 'validation' && e.field === 'body')
			return `Комментарий — от 1 до ${COMMENT_MAX} символов.`;
		if (e.code === 'validation' && e.field === 'parent_id')
			return 'Комментарий, на который вы отвечаете, удалён.';
	}
	return fallback(e);
}

// Похожие подборки, заданные вручную (максимум 12, порядок с 0 подряд).

export const RELATED_MAX = 12;

/** Связанные подборки по порядку (только публичные). */
export function getRelatedCollections(api: Api, id: string): Promise<SchemaCollection[]> {
	return unwrap(
		api.social.GET('/api/v1/social/collections/{id}/related', { params: { path: { id } } })
	);
}

/** Админ: заменить список связей целиком. */
export function adminSetRelated(api: Api, id: string, ids: string[]): Promise<SchemaCollection[]> {
	return unwrap(
		api.social.PUT('/api/v1/social/admin/collections/{id}/related', {
			params: { path: { id } },
			body: { ids }
		})
	);
}

/** Админ: добавить одну связь (идемпотентно — существующая не сдвигается). */
export function adminAddRelated(
	api: Api,
	id: string,
	relatedId: string,
	position?: number
): Promise<SchemaCollection[]> {
	return unwrap(
		api.social.PUT('/api/v1/social/admin/collections/{id}/related/{related_id}', {
			params: { path: { id, related_id: relatedId } },
			body: position === undefined ? {} : { position }
		})
	);
}

/** Админ: убрать связь (204). */
export async function adminRemoveRelated(api: Api, id: string, relatedId: string): Promise<void> {
	await unwrap(
		api.social.DELETE('/api/v1/social/admin/collections/{id}/related/{related_id}', {
			params: { path: { id, related_id: relatedId } }
		})
	);
}

/** Понятный текст ошибки правки связанных подборок. */
export function relatedAdminError(e: unknown, fallback: (e: unknown) => string): string {
	if (e instanceof ApiError) {
		if (e.code === 'collection_private') return 'Связать можно только публичную коллекцию.';
		if (e.code === 'validation' && e.field === 'related_id')
			return 'Нельзя связать коллекцию саму с собой.';
		if (e.code === 'validation' && e.field === 'ids')
			return `Не больше ${RELATED_MAX} связанных подборок, без повторов.`;
		if (e.status === 403) return 'Недостаточно прав.';
		if (e.status === 404) return 'Коллекция не найдена.';
	}
	return fallback(e);
}
