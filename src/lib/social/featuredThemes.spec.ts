import { describe, expect, it } from 'vitest';
import {
	normalizeAccent,
	pageAccent,
	resolvePageStyle,
	themeAccent,
	themeDefaultDim
} from './featuredThemes';

describe('resolvePageStyle', () => {
	it('defaults for empty collection', () => {
		expect(resolvePageStyle({})).toEqual({
			mode: 'header',
			dim: themeDefaultDim(null),
			blur: 0,
			effects: true,
			accent: null
		});
	});
	it('dim null → theme default; unknown theme → default', () => {
		expect(resolvePageStyle({ theme: 'horror', wallpaper_dim: null }).dim).toBe(
			themeDefaultDim('horror')
		);
		expect(resolvePageStyle({ theme: 'nope' }).dim).toBe(themeDefaultDim(null));
	});
	it('keeps explicit values, 0 included', () => {
		expect(
			resolvePageStyle({
				wallpaper_mode: 'page',
				wallpaper_dim: 0,
				wallpaper_blur: 20,
				effects: false,
				accent_color: '#B3001B'
			})
		).toEqual({ mode: 'page', dim: 0, blur: 20, effects: false, accent: '#b3001b' });
	});
	it('ignores out-of-range / unknown values', () => {
		const s = resolvePageStyle({ wallpaper_mode: 'x', wallpaper_dim: 101, wallpaper_blur: 2.5 });
		expect(s.mode).toBe('header');
		expect(s.dim).toBe(themeDefaultDim(null));
		expect(s.blur).toBe(0);
	});
});

describe('accent', () => {
	it('normalizeAccent', () => {
		expect(normalizeAccent(' #AbCdEf ')).toBe('#abcdef');
		expect(normalizeAccent('#abc')).toBeNull();
		expect(normalizeAccent(null)).toBeNull();
	});
	it('pageAccent: own colour over theme', () => {
		expect(pageAccent({ theme: 'horror', accent_color: '#3399ff' })).toBe('#3399ff');
		expect(pageAccent({ theme: 'horror', accent_color: null })).toBe(themeAccent('horror'));
	});
});

describe('pageAccent contrast', () => {
	it('осветляет слишком тёмный свой цвет', () => {
		expect(pageAccent({ accent_color: '#100000' })).toBe('color-mix(in oklab, #100000 45%, white)');
	});
	it('яркий цвет оставляет как есть', () => {
		expect(pageAccent({ accent_color: '#FF8800' })).toBe('#ff8800');
	});
});
