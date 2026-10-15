import { error, redirect } from '@sveltejs/kit';
import { browser } from '$app/env';
import { preloadCode } from '$app/navigation';
import { publicApi } from '#lib/api/client.ts';
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import { entityHref } from '#lib/catalog/kinds.ts';
import type { PageLoad } from './$types';

// /archive/{slug} — открыли фильм из архива. Сначала POST …/restore: бэкенд возвращает фильм на
// сайт со всеми данными TMDB (201; уже на сайте — 200), и мы сразу уходим на его карточку — это
// уже не архив. Не вернулся (409 — оставлен в архиве вручную, 429 — лимит, 503 — TMDB или возврат
// недоступны) — показываем архивную страницу: что есть в архиве. Нет нигде — 404.
export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = publicApi(fetch, url);
	const path = { slug: params.slug };
	// Пока бэкенд возвращает фильм (TMDB, 1–2 с), браузер грузит код карточки: после редиректа
	// ждать остаётся только её данные.
	if (browser) void preloadCode('/[kind=kind]/[slug]').catch(() => {});
	try {
		const entity = await unwrap(
			api.catalog.POST('/api/v1/catalog/archive/entities/{slug}/restore', { params: { path } })
		);
		redirect(302, entityHref(entity));
	} catch (e) {
		if (!(e instanceof ApiError)) throw e; // redirect и сбои сети/кода — дальше как есть
		if (e.status === 404) error(404, 'Такого фильма нет ни на сайте, ни в архиве.');
	}

	try {
		const doc = await unwrap(
			api.catalog.GET('/api/v1/catalog/archive/entities/{slug}', { params: { path } })
		);
		return { doc };
	} catch (e) {
		if (!(e instanceof ApiError && e.status === 404)) {
			error(e instanceof ApiError && e.status >= 400 ? e.status : 503, errorMessage(e));
		}
	}
	// Пока ходили, фильм могли вернуть на сайт.
	const entity = await unwrap(
		api.catalog.GET('/api/v1/catalog/entities/{slug}', { params: { path } })
	).catch(() => null);
	if (entity) redirect(302, entityHref(entity));
	error(404, 'Такого фильма нет ни на сайте, ни в архиве.');
};
