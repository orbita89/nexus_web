import { publicApi } from '#lib/api/client.ts';
import { KINDS } from '#lib/catalog/kinds.ts';
import { ratingsFor, settle } from '#lib/catalog/load.ts';
import { listPage } from '#lib/catalog/search.ts';
import { DEFAULT_SORT } from '#lib/catalog/sort.ts';
import { listTags, type TagEntry } from '#lib/catalog/tags.ts';
import { getFeaturedCollections } from '#lib/social/collections.ts';
import type { PageLoad } from './$types';

const STRIP_SIZE = 12;
/** Жанров в блоке: по два на раздел — ровно две строки плиток по четыре. */
const GENRES_PER_KIND = 2;
/** Тем в блоке: по три на раздел — иначе список занимает один раздел целиком. */
const THEMES_PER_KIND = 3;

export const load: PageLoad = async ({ fetch, url }) => {
	const api = publicApi(fetch, url);
	const [sections, tags, featured] = await Promise.all([
		Promise.all(
			KINDS.map(async (k) => ({
				...k,
				result: await settle(
					listPage(api, {}, { kind: k.kind, sort: DEFAULT_SORT, limit: STRIP_SIZE })
				)
			}))
		),
		settle(listTags(api)),
		settle(getFeaturedCollections(api))
	]);
	// Оценки всех полос — одним запросом.
	const ratings = await ratingsFor(
		api,
		sections.flatMap((s) => s.result.data?.items ?? [])
	);
	const all: TagEntry[] = tags.data ?? [];
	return {
		sections,
		// Подборки редакции — порядок как пришёл; ошибка или пусто — блок скрыт.
		featured: featured.data ?? [],
		ratings,
		// Жанры — по два на раздел, иначе блок целиком занимают фильмы: у них тегов на порядок
		// больше, и «Драма» с «Комедией» вытесняют и книги, и картины.
		genres: KINDS.flatMap((k) =>
			all
				.filter((t) => t.kind === 'genre' && (t.by_kind?.[k.kind] ?? 0) > 0)
				.toSorted((a, b) => (b.by_kind?.[k.kind] ?? 0) - (a.by_kind?.[k.kind] ?? 0))
				.slice(0, GENRES_PER_KIND)
				.map((tag) => ({ tag, kind: k.kind }))
		),
		// Темы — всё, что не жанр: чипами и без чисел. Набираем так же по разделам: по общему
		// счётчику весь блок заняли бы стили живописи — у фильмов таких меток почти нет.
		themes: [
			...new Map(
				KINDS.flatMap((k) =>
					all
						.filter((t) => t.kind === 'tag' && (t.by_kind?.[k.kind] ?? 0) > 0)
						.toSorted((a, b) => (b.by_kind?.[k.kind] ?? 0) - (a.by_kind?.[k.kind] ?? 0))
						.slice(0, THEMES_PER_KIND)
				).map((t) => [t.slug, t])
			).values()
		]
	};
};
