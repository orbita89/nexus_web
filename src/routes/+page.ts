import { publicApi } from '#lib/api/client.ts';
import { unwrap } from '#lib/api/errors.ts';
import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
import { KINDS } from '#lib/catalog/kinds.ts';
import { ratingsFor, settle } from '#lib/catalog/load.ts';
import { archiveMovies, listPage } from '#lib/catalog/search.ts';
import { DEFAULT_SORT } from '#lib/catalog/sort.ts';
import { listTags, type TagEntry } from '#lib/catalog/tags.ts';
import { getFeaturedCollections } from '#lib/social/collections.ts';
import type { PageLoad } from './$types';

const STRIP_SIZE = 12;
/** Людей в ленте: круглые портреты мельче постеров, их влезает больше. */
const PEOPLE_SIZE = 14;
/** Лучших в каждом разделе: три на раздел — лента из пятнадцати работ вперемешку. */
const RATED_PER_KIND = 3;
/** Каналов: четыре штуки — две строки по две, показывают, что в чате живут. */
const ROOMS_SIZE = 4;
/** Жанров в блоке: по два на раздел — ровно две строки плиток по четыре. */
const GENRES_PER_KIND = 2;
/** Тем в блоке: по три на раздел — иначе список занимает один раздел целиком. */
const THEMES_PER_KIND = 3;

/**
 * Жанры для плиток: по очереди разделами, самые крупные в своём разделе. Тег, уже взятый другим
 * разделом, пропускаем — иначе «Драма» занимает две плитки подряд с одним и тем же описанием.
 */
function takenGenres(all: TagEntry[]) {
	const used = new Set<string>();
	return KINDS.flatMap((k) => {
		const picked: { tag: TagEntry; kind: SchemaEntityKind }[] = [];
		for (const tag of all
			.filter((t) => t.kind === 'genre' && (t.by_kind?.[k.kind] ?? 0) > 0)
			.toSorted((a, b) => (b.by_kind?.[k.kind] ?? 0) - (a.by_kind?.[k.kind] ?? 0))) {
			if (picked.length === GENRES_PER_KIND) break;
			if (used.has(tag.slug)) continue;
			used.add(tag.slug);
			picked.push({ tag, kind: k.kind });
		}
		return picked;
	});
}

export const load: PageLoad = async ({ fetch, url }) => {
	const api = publicApi(fetch, url);
	const [sections, tags, featured, rated, people, archive, rooms] = await Promise.all([
		Promise.all(
			KINDS.map(async (k) => ({
				...k,
				result: await settle(
					listPage(api, {}, { kind: k.kind, sort: DEFAULT_SORT, limit: STRIP_SIZE })
				)
			}))
		),
		settle(listTags(api)),
		settle(getFeaturedCollections(api)),
		// Смысловая лента: не раздел, а повод. Берём лучшее в каждом разделе отдельно и
		// чередуем — один общий запрос отдавал одни фильмы (top_rated ведёт рейтинг IMDb),
		// а смысл сайта как раз в том, что книга и картина стоят рядом с фильмом.
		Promise.all(
			KINDS.map((k) =>
				settle(listPage(api, {}, { kind: k.kind, sort: 'top_rated', limit: RATED_PER_KIND }))
			)
		),
		settle(
			unwrap(
				api.catalog.GET('/api/v1/catalog/search/people', {
					params: { query: { limit: PEOPLE_SIZE } }
				})
			)
		),
		// Сколько фильмов в холодном архиве: их на порядок больше, чем на сайте, и в строке под
		// поиском это главная цифра. Архив лежит отдельно (Tantivy), недоступен — просто молчим.
		archiveMovies(fetch, url.origin),
		// Форум ещё не доделан, а каналы работают — на главной показываем живые комнаты:
		// порядок «active» ставит вперёд те, где писали за сутки.
		settle(
			unwrap(
				api.social.GET('/api/v1/social/chat/rooms', {
					params: { query: { sort: 'active', limit: ROOMS_SIZE } }
				})
			)
		)
	]);
	// Лучшее по кругу: фильм, сериал, книга, игра, картина — и снова фильм.
	const byKind = rated.map((r) => r.data?.items ?? []);
	const mixed = Array.from({ length: RATED_PER_KIND }, (_, i) =>
		byKind.map((items) => items[i]).filter((e) => e !== undefined)
	).flat();

	// Оценки всех полос — одним запросом.
	const ratings = await ratingsFor(api, [
		...sections.flatMap((s) => s.result.data?.items ?? []),
		...mixed
	]);
	const all: TagEntry[] = tags.data ?? [];
	return {
		sections,
		rated: mixed,
		// Сколько всего в каталоге: сумма total по разделам — цифра под поиском.
		total: sections.reduce((sum, s) => sum + (s.result.data?.total ?? 0), 0),
		archive,
		people: people.data?.items ?? [],
		rooms: rooms.data?.items ?? [],
		// Подборки редакции — порядок как пришёл; ошибка или пусто — блок скрыт.
		featured: featured.data ?? [],
		ratings,
		// Жанры — по два на раздел, иначе блок целиком занимают фильмы: у них тегов на порядок
		// больше, и «Драма» с «Комедией» вытесняют и книги, и картины. Жанр берём только раз:
		// «Драма» есть и в фильмах, и в сериалах — две одинаковые плитки читались как сбой.
		genres: takenGenres(all),
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
