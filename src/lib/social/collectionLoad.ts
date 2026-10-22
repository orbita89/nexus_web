import { redirect } from '@sveltejs/kit';
import { browser } from '$app/env';
import { publicApi } from '#lib/api/client.ts';
import { ApiError, unwrap } from '#lib/api/errors.ts';
import type { SchemaCollection, SchemaCollectionDetail } from '#lib/api/generated/social.ts';
import { api, ensureSession } from '#lib/auth/session.svelte.ts';
import { orError } from '#lib/catalog/load.ts';
import {
	getCollectionBySlug,
	getFeaturedCollections,
	isCollectionDetail
} from '#lib/social/collections.ts';
import { buildFeaturedUrl, rankSimilar } from '#lib/social/featured.ts';
import { isUuid } from '#lib/social/slug.ts';

const NOT_FOUND = 'Такой коллекции нет или она личная.';
/** Сколько похожих подборок собираем (страница «Похожие»; первая — «Далее»). */
const SIMILAR_LIMIT = 24;

export type CollectionLoadEvent = {
	fetch: typeof fetch;
	url: URL;
	params: { id: string };
	setHeaders: (headers: Record<string, string>) => void;
};

export type CollectionLoadResult = {
	collection: SchemaCollectionDetail | null;
	others: SchemaCollection[];
};

/** Связи, заданные админом (related), затем — ранжированные особые; без дублей и без самой коллекции. */
export function mergeSimilar(
	collection: SchemaCollectionDetail,
	listing: readonly SchemaCollection[],
	limit = SIMILAR_LIMIT
): SchemaCollection[] {
	const seen = new Set([collection.id]);
	const out: SchemaCollection[] = [];
	for (const c of [...(collection.related ?? []), ...rankSimilar(collection, listing, limit)]) {
		if (seen.has(c.id)) continue;
		seen.add(c.id);
		out.push(c);
	}
	return out.slice(0, limit);
}

/**
 * Коллекция: /collections/{uuid} или /collections/{slug} (особая) + `suffix` (''/'/discussion'/'/similar').
 * Сервер рендерит как для гостя: чужая или своя приватная — 404 (collection: null), и страница
 * перечитывается в браузере от имени пользователя. У особой со slug канонический адрес —
 * /collections/{slug}{suffix}: с UUID и со старых slug — 301. Особая кэшируется на CDN
 * (`cacheControl`), браузер не кэширует.
 */
export async function loadCollection(
	{ fetch, url, params, setHeaders }: CollectionLoadEvent,
	{
		suffix = '',
		cacheControl = 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600'
	}: { suffix?: string; cacheControl?: string } = {}
): Promise<CollectionLoadResult> {
	const cache = (collection: SchemaCollectionDetail) => {
		if (!browser && collection.is_featured) setHeaders({ 'cache-control': cacheControl });
	};
	// Список особых нужен только для ранжирования похожих. Сбой — пустой список.
	let listing: Promise<SchemaCollection[]> | null = null;
	const featuredList = () =>
		(listing ??= getFeaturedCollections(publicApi(fetch, url)).catch(() => []));
	const othersOf = async (collection: SchemaCollectionDetail) => {
		if (!collection.is_featured) return mergeSimilar(collection, []);
		if (collection.related?.length) return mergeSimilar(collection, []);
		return mergeSimilar(collection, await featuredList());
	};
	const canonical = (c: SchemaCollectionDetail) => buildFeaturedUrl(c) + suffix;

	if (!isUuid(params.id)) {
		const client = browser ? api : publicApi(fetch, url);
		// Особая со slug — список подборок грузим параллельно с ней.
		featuredList();
		if (browser) await ensureSession();
		const res = await orError(getCollectionBySlug(client, params.id), NOT_FOUND);
		if (!isCollectionDetail(res)) {
			redirect(
				301,
				('redirect_slug' in res
					? `/collections/${encodeURIComponent(res.redirect_slug)}`
					: `/collections/${res.redirect_id}`) + suffix
			);
		}
		if (res.slug && res.slug !== params.id) redirect(301, canonical(res));
		cache(res);
		return { collection: res, others: await othersOf(res) };
	}

	const path = { id: params.id };
	if (browser) {
		await ensureSession();
		const collection = await orError(
			unwrap(api.social.GET('/api/v1/social/collections/{id}', { params: { path } })),
			NOT_FOUND
		);
		if (collection.is_featured && collection.slug) redirect(301, canonical(collection));
		return { collection, others: await othersOf(collection) };
	}
	try {
		const collection = await unwrap(
			publicApi(fetch, url).social.GET('/api/v1/social/collections/{id}', { params: { path } })
		);
		if (collection.is_featured && collection.slug) redirect(301, canonical(collection));
		cache(collection);
		return { collection, others: await othersOf(collection) };
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) return { collection: null, others: [] };
		throw e;
	}
}
