import { describe, expect, it } from 'vitest';
import { headerMode } from './featuredThemes.ts';

describe('headerMode', () => {
	it('defaults to styled', () => {
		expect(headerMode({})).toBe('styled');
		expect(headerMode({ wallpaper_mode: 'header' })).toBe('styled');
		expect(headerMode({ wallpaper_mode: null })).toBe('styled');
	});
	it('defaults to plain for full-page wallpaper', () => {
		expect(headerMode({ wallpaper_mode: 'page' })).toBe('plain');
	});
	it('uses a valid header_mode from the backend', () => {
		const c = (m: unknown, w?: string) => ({ header_mode: m, wallpaper_mode: w }) as never;
		expect(headerMode(c('none'))).toBe('none');
		expect(headerMode(c('styled', 'page'))).toBe('styled');
		expect(headerMode(c('plain', 'header'))).toBe('plain');
	});
	it('ignores an invalid header_mode', () => {
		const c = (m: unknown, w?: string) => ({ header_mode: m, wallpaper_mode: w }) as never;
		expect(headerMode(c('fancy'))).toBe('styled');
		expect(headerMode(c(42, 'page'))).toBe('plain');
	});
});
