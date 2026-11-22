// Настройки читалки — общие для всех книг, в localStorage (`nexus.reader`).

export type Theme = 'light' | 'sepia' | 'dark';

/**
 * Как показывать книгу:
 * - `page` — страницами, одна колонка (как в книге);
 * - `spread` — страницами, на широком экране разворот в две колонки;
 * - `scroll` — лентой: текст прокручивается сплошь, без листания.
 */
export type Layout = 'page' | 'spread' | 'scroll';

export interface ReaderSettings {
	theme: Theme;
	fontSize: number;
	layout: Layout;
}

export const THEMES: Record<
	Theme,
	{ title: string; bg: string; fg: string; link: string; muted: string; line: string }
> = {
	light: {
		title: 'Светлая',
		bg: '#ffffff',
		fg: '#1d1d1f',
		link: '#b35900',
		muted: '#6b6b70',
		line: '#e3e3e6'
	},
	sepia: {
		title: 'Сепия',
		bg: '#f4ecd8',
		fg: '#433422',
		link: '#8a4b0f',
		muted: '#7a6a52',
		line: '#e0d4b8'
	},
	dark: {
		title: 'Тёмная',
		bg: '#141414',
		fg: '#d8d4cc',
		link: '#f5a25d',
		muted: '#8f8b84',
		line: '#2c2c2c'
	}
};

export const LAYOUTS: Record<Layout, string> = {
	page: 'Страница',
	spread: 'Разворот',
	scroll: 'Лента'
};

export const FONT_MIN = 80;
export const FONT_MAX = 200;
const KEY = 'nexus.reader';

/** Умолчания: на телефоне — лента (листать пальцем вниз привычнее), на большом экране — страница. */
export function defaults(narrow: boolean): ReaderSettings {
	return { theme: 'light', fontSize: 100, layout: narrow ? 'scroll' : 'page' };
}

/** Сохранённые настройки поверх умолчаний; мусор в хранилище — умолчание. */
export function parseSettings(raw: string | null, narrow: boolean): ReaderSettings {
	const base = defaults(narrow);
	try {
		const saved = JSON.parse(raw ?? '{}') as Partial<ReaderSettings>;
		return {
			theme: saved.theme && saved.theme in THEMES ? saved.theme : base.theme,
			fontSize:
				typeof saved.fontSize === 'number'
					? Math.min(FONT_MAX, Math.max(FONT_MIN, saved.fontSize))
					: base.fontSize,
			layout: saved.layout && saved.layout in LAYOUTS ? saved.layout : base.layout
		};
	} catch {
		return base;
	}
}

export function loadSettings(narrow: boolean): ReaderSettings {
	try {
		return parseSettings(localStorage.getItem(KEY), narrow);
	} catch {
		return defaults(narrow);
	}
}

export function saveSettings(settings: ReaderSettings) {
	try {
		localStorage.setItem(KEY, JSON.stringify(settings));
	} catch {
		// не сохранили — не страшно
	}
}

/** Атрибуты разметки foliate-js (paginator) для режима. */
export function layoutAttributes(layout: Layout): Record<string, string> {
	return {
		flow: layout === 'scroll' ? 'scrolled' : 'paginated',
		'max-column-count': layout === 'spread' ? '2' : '1',
		'max-inline-size': layout === 'spread' ? '1440px' : '720px'
	};
}
