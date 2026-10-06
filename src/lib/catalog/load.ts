// Загрузка публичных данных в +page.ts. Два исхода ошибок:
// - карточка (сущность, человек, тег): 404 → страница 404, остальное → страница ошибки;
// - список: ошибка показывается на самой странице (LoadError), фильтры остаются на месте.
import { error } from '@sveltejs/kit';
import { ApiError, errorMessage } from '#lib/api/errors.ts';

export type Loaded<T> = { data: T; error: null } | { data: null; error: string };

/** Данные или текст ошибки для LoadError — для списков. */
export async function settle<T>(promise: Promise<T>): Promise<Loaded<T>> {
	try {
		return { data: await promise, error: null };
	} catch (e) {
		return { data: null, error: errorMessage(e) };
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
