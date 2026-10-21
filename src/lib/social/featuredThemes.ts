import type { SchemaCollection } from '#lib/api/generated/social.ts';
import {
	DEFAULT_THEME,
	FEATURED_THEMES,
	type FeaturedTheme,
	type FeaturedThemeId
} from '#lib/catalog/themes.ts';

/**
 * Оформление особых коллекций: собственная обложка (cover_url), тематический пресет (theme)
 * или коллаж из обложек preview. Бэкенд полей cover_url/theme пока не отдаёт
 * (docs/backend-tasks/featured-collections.md) — читаем их защитно, как необязательное расширение.
 */

/** Включить, когда cover_url/theme появятся в generated/social.ts и в PATCH admin/…/featured. */
export const FEATURED_STYLE_SUPPORTED = false;

export {
	DEFAULT_THEME,
	FEATURED_THEMES,
	type FeaturedTheme,
	type FeaturedThemeId
} from '#lib/catalog/themes.ts';

const BY_ID = new Map(FEATURED_THEMES.map((t) => [t.id, t]));

/** Поля, которых пока нет в контракте. */
type StyleExtension = { cover_url?: string | null; theme?: string | null };

function ext(c: Pick<SchemaCollection, 'id'>): StyleExtension {
	return c as unknown as StyleExtension;
}

export function collectionCoverUrl(c: Pick<SchemaCollection, 'id'>): string | null {
	const v = ext(c).cover_url;
	return typeof v === 'string' && /^https?:\/\//.test(v.trim()) ? v.trim() : null;
}

export function collectionThemeId(c: Pick<SchemaCollection, 'id'>): FeaturedThemeId | null {
	const v = ext(c).theme;
	return typeof v === 'string' && BY_ID.has(v as FeaturedThemeId) ? (v as FeaturedThemeId) : null;
}

export type FeaturedLook =
	| { kind: 'cover'; url: string; theme: FeaturedTheme }
	| { kind: 'theme'; theme: FeaturedTheme }
	| { kind: 'collage'; theme: FeaturedTheme };

/** Порядок: cover_url → пресет theme → коллаж из preview (с оформлением по умолчанию). */
export function resolveFeaturedLook(c: Pick<SchemaCollection, 'id'>): FeaturedLook {
	const themeId = collectionThemeId(c);
	const theme = (themeId && BY_ID.get(themeId)) || DEFAULT_THEME;
	const url = collectionCoverUrl(c);
	if (url) return { kind: 'cover', url, theme };
	if (themeId && themeId !== 'default') return { kind: 'theme', theme };
	return { kind: 'collage', theme };
}
