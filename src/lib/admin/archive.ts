// Холодный архив каталога: фильмы вне топ-100 000, которых нет на сайте. Поиск — без
// авторизации, возврат на сайт (промоушен) — только admin. Здесь чистые функции; состояние
// возвратов — promote.svelte.ts.

import { ApiError, errorMessage } from '#lib/api/errors.ts';
import type { SchemaArchiveDoc } from '#lib/api/generated/catalog.ts';
import { entityHref } from '#lib/catalog/kinds.ts';

/** Больше бэкенд не отдаёт: пагинации и total у архива нет. */
export const ARCHIVE_LIMIT = 20;

export const tmdbHref = (tmdbId: number) => `https://www.themoviedb.org/movie/${tmdbId}`;

/** Оригинальное название, если оно не совпадает с русским; иначе null. */
export function originalTitle(doc: Pick<SchemaArchiveDoc, 'title' | 'original_title'>) {
	const original = doc.original_title?.trim();
	if (!original) return null;
	return original.toLocaleLowerCase('ru') === doc.title.trim().toLocaleLowerCase('ru')
		? null
		: original;
}

/** TMDB popularity с одной цифрой после запятой: 1.84 → «1,8». */
export function formatPopularity(popularity: number): string {
	return popularity.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export interface PromoteFailure {
	message: string;
	/** Документа в архиве больше нет — строку убрать. */
	gone: boolean;
	/** Фильм уже на сайте — ссылка на карточку. */
	siteHref: string | null;
}

/**
 * Ошибка возврата → что показать. 409 различаем по тексту `error` (стабилен в этой версии API):
 * пересборка архива — «попробуйте позже», остальное (slug или TMDB id заняты) — «уже на сайте».
 */
export function promoteFailure(e: unknown, doc: Pick<SchemaArchiveDoc, 'kind' | 'slug'>) {
	const failure: PromoteFailure = { message: errorMessage(e), gone: false, siteHref: null };
	if (!(e instanceof ApiError)) return failure;
	if (e.status === 404) {
		return { ...failure, message: 'Фильма уже нет в архиве', gone: true };
	}
	if (e.status === 409) {
		return /being rebuilt/.test(e.serverMessage ?? '')
			? { ...failure, message: 'Архив пересобирается, попробуйте через несколько минут' }
			: { ...failure, message: 'Уже есть на сайте', siteHref: entityHref(doc) };
	}
	if (e.status === 503) return { ...failure, message: 'Архив временно недоступен' };
	return failure;
}
