// Архив в выдаче каталога (archive=1): фильмы архива по названию за фильмами сайта. Архив — Tantivy,
// только поиск по названию (без фильтров и «всего архива»). Грузится в браузере, а не в load:
// переключатель «Архив» не перезапрашивает выдачу сайта.
import { guestApi } from '#lib/auth/session.svelte.ts';
import { liveQuery } from '#lib/social/card-live.svelte.ts';
import { settle } from './load.ts';
import { archivePage } from './search.ts';

/** Архивных фильмов за порцию: у архива limit не больше 20; дальше — «Показать ещё». */
export const ARCHIVE_PAGE = 20;

/**
 * Первая порция архива для ResultsFeed. query — название или null (архив не нужен).
 * Ошибка архива — выдача просто без него. Вызывать при создании компонента.
 */
export function archiveFeed(query: () => string | null) {
	// Строка, а не данные страницы: смена порядка или фильтра сайта не перезапрашивает архив.
	const q = $derived(query());
	const result = liveQuery(
		() => q,
		async (q) => ({ q, page: q ? await settle(archivePage(guestApi, q, ARCHIVE_PAGE)) : null })
	);
	const archive = $derived.by(() => {
		const answer = result.current?.data;
		return q && answer?.q === q && answer.page?.data ? { q, first: answer.page.data } : null;
	});
	return {
		get archive() {
			return archive;
		},
		/** Архив нужен, а ответа на этот запрос ещё нет. */
		get loading() {
			return !!q && result.current?.data?.q !== q;
		}
	};
}
