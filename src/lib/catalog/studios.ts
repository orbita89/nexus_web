// Студии: страница /studios/{slug} (GET /studios/{slug}) и её фильмы — тот же список, что в
// каталоге: Meilisearch с фильтром `studio` (точное название студии, как в metadata.studios).
import type { Api } from '#lib/api/client.ts';
import { listPage } from './search.ts';
import type { ListSort } from './sort.ts';
import { PAGE_SIZE } from './url.ts';

export const studioHref = (slug: string) => `/studios/${slug}`;

/**
 * Порция фильмов студии по её названию — для load страницы и для «Показать ещё» и сортировки в
 * браузере.
 */
export function studioFilms(api: Api, name: string, sort: ListSort, offset: number) {
	return listPage(api, { studio: name }, { sort, limit: PAGE_SIZE, offset });
}

/** Флаг страны из ISO 3166-1 alpha-2: US → 🇺🇸. Не две латинские буквы — пусто. */
export function countryFlag(code: string): string {
	const upper = code.toUpperCase();
	if (!/^[A-Z]{2}$/.test(upper)) return '';
	return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Подпись ссылки на сайт: https://www.warnerbros.com/ → warnerbros.com; не адрес — null. */
export function homepageLabel(href: string): string | null {
	try {
		const url = new URL(href);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
		const path = url.pathname.replace(/\/+$/, '');
		return url.hostname.replace(/^www\./, '') + path;
	} catch {
		return null;
	}
}
