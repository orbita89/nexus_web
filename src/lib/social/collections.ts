// Коллекции: проверка форм и перестановка пунктов. Порядок сохраняется целиком
// (PUT /collections/{id}/items: все slug'и ровно по разу).

import type { Api } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import type {
	SchemaCollection,
	SchemaCollectionBySlug,
	SchemaCollectionDetail
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

/**
 * Админ: сделать коллекцию особой, поменять её позицию и/или адрес (slug).
 * Приватная или неверный slug → 400, slug занят → 409.
 */
export function adminSetFeatured(
	api: Api,
	id: string,
	opts: { position?: number; slug?: string } = {}
): Promise<SchemaCollection> {
	const body: { position?: number; slug?: string } = {};
	if (opts.position !== undefined) body.position = opts.position;
	if (opts.slug !== undefined) body.slug = opts.slug;
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
	return e instanceof ApiError && e.status === 400 && /featured/i.test(e.serverMessage ?? '');
}

export const FEATURED_PRIVATE_ERROR =
	'Особую коллекцию нельзя сделать приватной — сначала уберите её из подборок';

/** «Топ» — если название похоже на рейтинг («Топ-10», «Top 100», «Лучшие …»), иначе «Подборка редакции». */
export function featuredBadge(title: string): string {
	return /(^|[^\p{L}])(топ|top)([^\p{L}]|$)|лучш/iu.test(title) ? 'Топ' : 'Подборка редакции';
}

/** Понятный текст ошибки админских действий с подборками (400 — приватная, 403 — нет прав). */
export function featuredAdminError(e: unknown, fallback: (e: unknown) => string): string {
	if (e instanceof ApiError) {
		if (e.status === 403) return 'Недостаточно прав.';
		if (e.status === 409) return 'Такой адрес уже занят.';
		if (e.status === 400) {
			// У 400 нет отдельного code: приватность узнаём по тексту бэкенда, иначе — общий текст.
			const raw = `${e.code ?? ''} ${e.serverMessage ?? ''}`.toLowerCase();
			if (/private|public|приват|публич/.test(raw)) return 'Сначала сделайте коллекцию публичной.';
			return `Не удалось сохранить: ${e.serverMessage ?? e.message}`;
		}
		if (e.status === 404) return 'Коллекция не найдена.';
	}
	return fallback(e);
}
