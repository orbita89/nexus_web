// Загрузка публичных данных в +page.ts. Два исхода ошибок:
// - карточка (сущность, человек, тег): 404 → страница 404, остальное → страница ошибки;
// - список: ошибка показывается на самой странице (LoadError), фильтры остаются на месте.
import { error } from '@sveltejs/kit';
import type { Api } from '#lib/api/client.ts';
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import type { SchemaRatingBrief } from '#lib/api/generated/social.ts';

export type Loaded<T> = { data: T; error: null } | { data: null; error: string };

/** Данные или текст ошибки для LoadError — для списков. */
export async function settle<T>(promise: Promise<T>): Promise<Loaded<T>> {
	try {
		return { data: await promise, error: null };
	} catch (e) {
		return { data: null, error: errorMessage(e) };
	}
}

/** slug → средняя и число оценок; нет slug'а — оценок не показываем. */
export type Ratings = Record<string, SchemaRatingBrief>;

/** Сколько slug'ов принимает GET /social/ratings за раз. */
const RATINGS_LIMIT = 100;

/**
 * Оценки для сетки — один пакетный запрос на страницу (без токена, на сервере и в браузере).
 * Ошибка — пусто: сетка без оценок, а не ошибка страницы.
 */
export async function ratingsFor(
	api: Pick<Api, 'social'>,
	entities: readonly { slug: string }[]
): Promise<Ratings> {
	const slugs = [...new Set(entities.map((e) => e.slug))].slice(0, RATINGS_LIMIT);
	if (!slugs.length) return {};
	try {
		return await unwrap(
			api.social.GET('/api/v1/social/ratings', { params: { query: { slugs: slugs.join(',') } } })
		);
	} catch {
		return {};
	}
}

/** Данные или ошибка SvelteKit (страница +error) — для карточек. */
export async function orError<T>(
	promise: Promise<T>,
	notFound = 'Такой страницы нет.'
): Promise<T> {
	try {
		return await promise;
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) error(404, notFound);
		// Сбой сети или бэкенда для пользователя — «сервис недоступен», а не 500 фронтенда.
		const status = e instanceof ApiError && e.status >= 400 ? e.status : 503;
		error(status, errorMessage(e));
	}
}
