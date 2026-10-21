import type { SchemaCollection } from '#lib/api/generated/social.ts';
import {
	DEFAULT_THEME,
	FEATURED_THEMES,
	type FeaturedTheme,
	type FeaturedThemeId
} from '#lib/catalog/themes.ts';

/**
 * Оформление особых коллекций: обои (wallpaper_url — фон шапки), обложка (cover_url — карточка,
 * og:image), тематический пресет (theme) или коллаж из обложек preview. Бэкенд принимает любой
 * theme вида `^[a-z0-9-]{1,32}$`; неизвестный id фронтенд игнорирует.
 */

export {
	DEFAULT_THEME,
	FEATURED_THEMES,
	type FeaturedTheme,
	type FeaturedThemeId
} from '#lib/catalog/themes.ts';

const BY_ID = new Map(FEATURED_THEMES.map((t) => [t.id, t]));

type Style = Pick<SchemaCollection, 'cover_url' | 'wallpaper_url' | 'theme'>;

function httpUrl(v: string | null | undefined): string | null {
	const t = v?.trim();
	return t && /^https?:\/\//.test(t) ? t : null;
}

export function collectionCoverUrl(c: Pick<Style, 'cover_url'>): string | null {
	return httpUrl(c.cover_url);
}

export function collectionWallpaperUrl(c: Pick<Style, 'wallpaper_url'>): string | null {
	return httpUrl(c.wallpaper_url);
}

export function collectionThemeId(c: Pick<Style, 'theme'>): FeaturedThemeId | null {
	const v = c.theme;
	return v && BY_ID.has(v as FeaturedThemeId) ? (v as FeaturedThemeId) : null;
}

export function themeById(id: FeaturedThemeId | null): FeaturedTheme {
	return (id && BY_ID.get(id)) || DEFAULT_THEME;
}

export type FeaturedLook =
	| { kind: 'cover'; url: string; theme: FeaturedTheme }
	| { kind: 'theme'; theme: FeaturedTheme }
	| { kind: 'collage'; theme: FeaturedTheme };

/** Карточка: cover_url → пресет theme → коллаж из preview (с оформлением по умолчанию). */
export function resolveFeaturedLook(c: Style): FeaturedLook {
	const themeId = collectionThemeId(c);
	const theme = themeById(themeId);
	const url = collectionCoverUrl(c);
	if (url) return { kind: 'cover', url, theme };
	if (themeId && themeId !== 'default') return { kind: 'theme', theme };
	return { kind: 'collage', theme };
}

/** Шапка страницы: wallpaper_url → пресет theme → коллаж. */
export function resolveFeaturedHero(c: Style): FeaturedLook {
	const themeId = collectionThemeId(c);
	const theme = themeById(themeId);
	const url = collectionWallpaperUrl(c);
	if (url) return { kind: 'cover', url, theme };
	if (themeId && themeId !== 'default') return { kind: 'theme', theme };
	return { kind: 'collage', theme };
}

/** Клиентская проверка URL оформления (правила бэкенда): null — всё в порядке. */
export function styleUrlError(v: string): string | null {
	const t = v.trim();
	if (!t) return null;
	if (t.length > 2048) return 'Адрес — не длиннее 2048 символов.';
	if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(t)) return 'Нужен адрес вида https://…';
	return null;
}
