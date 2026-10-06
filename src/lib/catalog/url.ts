// Состояние списков живёт в адресе: фильтры и страница — query-параметры. Так ссылкой можно
// поделиться, назад/вперёд работают сами, а сервер рендерит ровно то, что в адресе.
//
//   /films?tag=sci-fi&year=2021&q=дюна&offset=24
//
// Пустые значения и offset=0 в адрес не пишутся: у одной выдачи один адрес.

/** Размер страницы во всех списках: делится на 2, 3, 4 и 6 колонок сетки. */
export const PAGE_SIZE = 24;

export type Query = Record<string, string | number | null | undefined>;

/** URL или page.url из $app/state (у него searchParams только для чтения). */
export interface UrlLike {
	readonly pathname: string;
	readonly searchParams: Omit<URLSearchParams, 'set' | 'append' | 'delete' | 'sort'>;
}

/** Путь + query без пустых значений и без offset=0. */
export function withQuery(path: string, query: Query): string {
	const params = new URLSearchParams();
	for (const [key, raw] of Object.entries(query)) {
		const value = typeof raw === 'string' ? raw.trim() : raw;
		if (value === null || value === undefined || value === '') continue;
		if (key === 'offset' && Number(value) <= 0) continue;
		params.set(key, String(value));
	}
	const qs = params.toString();
	return qs ? `${path}?${qs}` : path;
}

/** Текущий адрес с изменёнными фильтрами. Выдача меняется — значит, снова с первой страницы. */
export function filterUrl(url: UrlLike, changes: Query): string {
	return withQuery(url.pathname, {
		...Object.fromEntries(url.searchParams),
		...changes,
		offset: null
	});
}

/** Адрес из отправленной формы фильтров (без JS браузер отправил бы и пустые поля). */
export function formUrl(path: string, form: FormData): string {
	const query: Query = {};
	for (const [key, value] of form) if (typeof value === 'string') query[key] = value;
	return withQuery(path, query);
}

/** Текущий адрес на другой странице, фильтры сохраняются. */
export function pageUrl(url: UrlLike, offset: number): string {
	return withQuery(url.pathname, { ...Object.fromEntries(url.searchParams), offset });
}

/** offset из адреса: целое ≥ 0, мусор — 0. */
export function readOffset(url: UrlLike): number {
	const n = Number(url.searchParams.get('offset'));
	return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Год из адреса: четыре цифры, иначе undefined (кривой год не уходит в API и не даёт 400). */
export function readYear(url: UrlLike): number | undefined {
	const raw = url.searchParams.get('year')?.trim() ?? '';
	return /^\d{4}$/.test(raw) ? Number(raw) : undefined;
}

/** Непустой строковый параметр или undefined. */
export function readText(url: UrlLike, key: string): string | undefined {
	return url.searchParams.get(key)?.trim() || undefined;
}

export interface PageLink {
	/** Номер страницы с 1. */
	number: number;
	offset: number;
	current: boolean;
}

/**
 * Ссылки пагинации: первая, последняя и соседние с текущей, на месте пропусков — null.
 * 10 страниц, текущая 5 → 1 … 4 5 6 … 10.
 */
export function pageLinks(total: number, limit: number, offset: number): (PageLink | null)[] {
	const pages = Math.max(1, Math.ceil(total / limit));
	const current = Math.min(pages, Math.floor(offset / limit) + 1);
	// До семи страниц показываем все, дальше — края и соседей текущей.
	const candidates =
		pages <= 7
			? Array.from({ length: pages }, (_, i) => i + 1)
			: [1, current - 1, current, current + 1, pages];
	const shown = [...new Set(candidates)].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

	const links: (PageLink | null)[] = [];
	const link = (n: number) => ({ number: n, offset: (n - 1) * limit, current: n === current });
	let prev = 0;
	for (const n of shown) {
		// Пропуск в одну страницу показываем самой страницей: «1 2 3», а не «1 … 3».
		if (n - prev === 2) links.push(link(n - 1));
		else if (n - prev > 2) links.push(null);
		links.push(link(n));
		prev = n;
	}
	return links;
}
