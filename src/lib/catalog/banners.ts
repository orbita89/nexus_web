// Баннеры (промо, новости) v2: виды image / html (slides устарел: несколько баннеров листает общая карусель), кнопки, темы, цели по страницам и путям.
// Публичный список — без токена, по пути страницы (GET /banners?path=…), уже отфильтрован
// (активные, в периоде, по targets/exclude_paths) и отсортирован; для /admin* всегда [].
// Админские вызовы — с токеном admin (api из #lib/auth/session.svelte.ts).
// content_html бэкенд санитизирует сам; на фронте всё равно пропускать через DOMPurify при выводе.

import { ApiError, unwrap } from '#lib/api/errors.ts';
import type { Api } from '#lib/api/client.ts';
import type {
	SchemaBanner,
	SchemaBannerButton,
	SchemaBannerKind,
	SchemaBannerSlide,
	SchemaBannerTarget,
	SchemaCreateBanner,
	SchemaPageBanner,
	SchemaUpdateBanner
} from '#lib/api/generated/catalog.ts';

export type Banner = SchemaBanner;
export type BannerSlide = SchemaBannerSlide;
export type BannerButton = SchemaBannerButton;
export type BannerTarget = SchemaBannerTarget;
export type BannerKind = SchemaBannerKind;
export type BannerButtonStyle = BannerButton['style'];
export type CreateBanner = SchemaCreateBanner;
export type UpdateBanner = SchemaUpdateBanner;
export type BannerPageList = SchemaPageBanner;

/** Виды, которые можно выбрать в админке; `slides` в контракте остался, но не используется. */
export const BANNER_KINDS = ['image', 'html'] as const satisfies readonly BannerKind[];
export const BANNER_BUTTON_STYLES = [
	'primary',
	'secondary',
	'ghost'
] as const satisfies readonly BannerButtonStyle[];

/** Темы оформления (banners::THEMES на бэкенде). */
export const BANNER_THEMES = [
	'default',
	'halloween',
	'romance',
	'new-year',
	'horror',
	'sci-fi',
	'family',
	'summer'
] as const;
export type BannerTheme = (typeof BANNER_THEMES)[number];
export const isBannerTheme = (value: unknown): value is BannerTheme =>
	typeof value === 'string' && (BANNER_THEMES as readonly string[]).includes(value);

/** Страницы для target {type:'page'}. 'films' — ровно /films; страницы фильмов — path '/films/*'. */
export const BANNER_PAGES = ['home', 'films', 'series', 'books', 'games', 'people'] as const;
export type BannerPage = (typeof BANNER_PAGES)[number];
export const isBannerPage = (value: string): value is BannerPage =>
	(BANNER_PAGES as readonly string[]).includes(value);

export const BANNER_LIMITS = { buttons: 3, targets: 20, buttonLabel: 60 } as const;

/** Публичный список баннеров для пути страницы (`/films/dune-2021`). */
export function getBanners(api: Api, path: string): Promise<Banner[]> {
	return unwrap(api.catalog.GET('/api/v1/catalog/banners', { params: { query: { path } } }));
}

/** Баннеры для SSR-загрузки: ошибка — пустой список, блок просто не показывается. */
export async function safeBanners(api: Api, path: string): Promise<Banner[]> {
	try {
		return await getBanners(api, path);
	} catch {
		return [];
	}
}

export interface AdminBannersQuery {
	/** `all`, страница (`home`, `films`, …) или шаблон пути. Без него — все. */
	target?: string;
	/** Совместимость: то же, что target=<page>. */
	page?: BannerPage;
	/** Подстрока заголовка. */
	q?: string;
	limit?: number;
	offset?: number;
}

/** Все баннеры, включая выключенные и вне периода показа. */
export function adminListBanners(api: Api, query: AdminBannersQuery = {}): Promise<BannerPageList> {
	return unwrap(api.catalog.GET('/api/v1/catalog/admin/banners', { params: { query } }));
}

export function createBanner(api: Api, body: CreateBanner): Promise<Banner> {
	return unwrap(api.catalog.POST('/api/v1/catalog/admin/banners', { body }));
}

/** Переданные поля заменяются (массивы — целиком), null очищает. */
export function updateBanner(api: Api, id: string, body: UpdateBanner): Promise<Banner> {
	return unwrap(
		api.catalog.PATCH('/api/v1/catalog/admin/banners/{id}', { params: { path: { id } }, body })
	);
}

export async function deleteBanner(api: Api, id: string): Promise<void> {
	await unwrap(
		api.catalog.DELETE('/api/v1/catalog/admin/banners/{id}', { params: { path: { id } } })
	);
}

/** Сегмент пути поля: имя или индекс массива. */
export type FieldPathSegment = string | number;

/** `buttons[0].url` → ['buttons', 0, 'url']. Пустая строка → []. */
export function parseFieldPath(field: string): FieldPathSegment[] {
	const out: FieldPathSegment[] = [];
	for (const m of field.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
		out.push(m[2] !== undefined ? Number(m[2]) : m[1]);
	}
	return out;
}

export interface BannerFieldError {
	/** Исходная строка поля или null (ошибка без поля: неизвестный kind/style/target). */
	field: string | null;
	path: FieldPathSegment[];
	message: string;
}

/** Ошибка 400 из create/update → поле и текст; не 400 / не ApiError → null. */
export function bannerFieldError(e: unknown): BannerFieldError | null {
	if (!(e instanceof ApiError) || e.status !== 400) return null;
	const message = e.serverMessage ?? e.message;
	return { field: e.field, path: e.field ? parseFieldPath(e.field) : [], message };
}
