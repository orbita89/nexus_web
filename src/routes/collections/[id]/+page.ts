import { redirect } from '@sveltejs/kit';
import { browser } from '$app/env';
import { publicApi } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import type { SchemaCollectionDetail } from '#lib/api/generated/social.ts';
import { api, ensureSession } from '#lib/auth/session.svelte.ts';
import { orError } from '#lib/catalog/load.ts';
import { getCollectionBySlug, isCollectionDetail } from '#lib/social/collections.ts';
import { buildFeaturedUrl } from '#lib/social/featured.ts';
import { isUuid } from '#lib/social/slug.ts';
import type { PageLoad } from './$types';

const NOT_FOUND = 'Такой коллекции нет или она личная.';

// Коллекция: /collections/{uuid} или /collections/{slug} (особая). Сервер рендерит как для гостя:
// чужая или своя приватная — 404, и тогда страница перечитывается в браузере от имени пользователя
// (владелец свою приватную увидит, остальные — 404). Публичная — сразу с сервера (SEO).
// У особой со slug канонический адрес — /collections/{slug}: с UUID и со старых slug — 301.
export const load: PageLoad = async ({ fetch, url, params, setHeaders }) => {
	const cacheFeatured = (collection: SchemaCollectionDetail) => {
		// Особая коллекция рендерится как для гостя и одинакова для всех — кэшируем на CDN/прокси;
		// браузер не кэширует (max-age=0), иначе после правки F5 показывает старую версию.
		if (!browser && collection.is_featured) {
			setHeaders({
				'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600'
			});
		}
	};

	if (!isUuid(params.id)) {
		const client = browser ? api : publicApi(fetch, url);
		if (browser) await ensureSession();
		const res = await orError(getCollectionBySlug(client, params.id), NOT_FOUND);
		if (!isCollectionDetail(res)) {
			redirect(
				301,
				'redirect_slug' in res
					? `/collections/${encodeURIComponent(res.redirect_slug)}`
					: `/collections/${res.redirect_id}`
			);
		}
		if (res.slug && res.slug !== params.id) redirect(301, buildFeaturedUrl(res));
		cacheFeatured(res);
		return { collection: res };
	}

	const path = { id: params.id };
	if (browser) {
		await ensureSession();
		const collection = await orError(
			unwrap(api.social.GET('/api/v1/social/collections/{id}', { params: { path } })),
			NOT_FOUND
		);
		if (collection.is_featured && collection.slug) redirect(301, buildFeaturedUrl(collection));
		return { collection };
	}
	try {
		const collection = await unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/collections/{id}', { params: { path } })
		);
		if (collection.is_featured && collection.slug) redirect(301, buildFeaturedUrl(collection));
		cacheFeatured(collection);
		return { collection };
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) return { collection: null };
		throw e;
	}
};
