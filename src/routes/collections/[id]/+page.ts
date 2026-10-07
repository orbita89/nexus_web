import { browser } from '$app/env';
import { publicApi } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import { api, ensureSession } from '#lib/auth/session.svelte.ts';
import { orError } from '#lib/catalog/load.ts';
import type { PageLoad } from './$types';

// Коллекция. Сервер рендерит как для гостя: чужая или своя приватная — 404, и тогда страница
// перечитывается в браузере от имени пользователя (владелец свою приватную увидит, остальные —
// 404). Публичная — сразу с сервера (SEO).
export const load: PageLoad = async ({ fetch, url, params }) => {
	const path = { id: params.id };
	if (browser) {
		await ensureSession();
		const collection = await orError(
			unwrap(api.social.GET('/api/v1/social/collections/{id}', { params: { path } })),
			'Такой коллекции нет или она личная.'
		);
		return { collection };
	}
	try {
		const collection = await unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/collections/{id}', { params: { path } })
		);
		return { collection };
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) return { collection: null };
		throw e;
	}
};
