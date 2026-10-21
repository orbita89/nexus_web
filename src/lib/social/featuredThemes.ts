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

// Оформление страницы: wallpaper_mode / wallpaper_dim / wallpaper_blur / effects / accent_color.

export type WallpaperMode = 'header' | 'page';

type PageStyleFields = Pick<
	SchemaCollection,
	'theme' | 'wallpaper_mode' | 'wallpaper_dim' | 'wallpaper_blur' | 'effects' | 'accent_color'
>;

export type FeaturedPageStyle = {
	mode: WallpaperMode;
	/** Затемнение обоев, 0–100 (null у коллекции → по теме). */
	dim: number;
	/** Размытие обоев, px 0–20. */
	blur: number;
	effects: boolean;
	/** Свой акцент #rrggbb или null — цвет темы. */
	accent: string | null;
};

/** Затемнение обоев по умолчанию для темы, %. */
const THEME_DIM: Record<string, number> = {
	default: 55,
	horror: 70,
	halloween: 65,
	'sci-fi': 60,
	romance: 45,
	'new-year': 45,
	family: 40,
	summer: 40
};

export function themeDefaultDim(id: string | null | undefined): number {
	return THEME_DIM[id ?? 'default'] ?? THEME_DIM.default;
}

/** Акцент темы — CSS-переменная daisyUI. */
const THEME_ACCENT: Record<string, string> = {
	default: 'var(--color-primary)',
	halloween: 'var(--color-warning)',
	romance: 'var(--color-secondary)',
	'new-year': 'var(--color-info)',
	horror: 'var(--color-error)',
	'sci-fi': 'var(--color-accent)',
	family: 'var(--color-success)',
	summer: 'var(--color-warning)'
};

export function themeAccent(id: string | null | undefined): string {
	return THEME_ACCENT[id ?? 'default'] ?? THEME_ACCENT.default;
}

const HEX = /^#[0-9a-f]{6}$/;

/** Нормализует #rrggbb в нижний регистр; иное — null. */
export function normalizeAccent(v: string | null | undefined): string | null {
	const t = v?.trim().toLowerCase();
	return t && HEX.test(t) ? t : null;
}

function intIn(v: unknown, min: number, max: number): number | null {
	return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

/** Итоговое оформление страницы с дефолтами (null/неверное → по теме / по умолчанию). */
export function resolvePageStyle(c: Partial<PageStyleFields>): FeaturedPageStyle {
	const theme = collectionThemeId({ theme: c.theme ?? null });
	return {
		mode: c.wallpaper_mode === 'page' ? 'page' : 'header',
		dim: intIn(c.wallpaper_dim, 0, 100) ?? themeDefaultDim(theme),
		blur: intIn(c.wallpaper_blur, 0, 20) ?? 0,
		effects: c.effects !== false,
		accent: normalizeAccent(c.accent_color)
	};
}

/** Относительная яркость #rrggbb (WCAG), 0…1. */
function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Значение CSS-переменной акцента страницы: свой цвет или акцент темы. Страница тёмная,
 * поэтому слишком тёмный свой цвет осветляется, чтобы номера и ссылки читались.
 */
export function pageAccent(c: Partial<PageStyleFields>): string {
	const own = normalizeAccent(c.accent_color);
	if (!own) return themeAccent(collectionThemeId({ theme: c.theme ?? null }));
	return luminance(own) < 0.12 ? `color-mix(in oklab, ${own} 45%, white)` : own;
}
