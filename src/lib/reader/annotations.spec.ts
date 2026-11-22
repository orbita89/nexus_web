import { describe, expect, it } from 'vitest';
import { colorHex, HIGHLIGHT_COLORS, inBookOrder, readHref } from './annotations.ts';

describe('annotations', () => {
	it('семь цветов; вне диапазона — первый', () => {
		expect(HIGHLIGHT_COLORS).toHaveLength(7);
		expect(colorHex(3)).toBe(HIGHLIGHT_COLORS[3].hex);
		expect(colorHex(null)).toBe(HIGHLIGHT_COLORS[0].hex);
		expect(colorHex(9)).toBe(HIGHLIGHT_COLORS[0].hex);
	});

	it('порядок в книге: по доле, без доли — в конце', () => {
		const a = { fraction: 0.5, created_at: '2026-01-02' };
		const b = { fraction: 0.1, created_at: '2026-01-03' };
		const c = { fraction: null, created_at: '2026-01-01' };
		expect(inBookOrder([a, c, b])).toEqual([b, a, c]);
	});

	it('ссылка в читалку на место', () => {
		expect(readHref('dune', 'epubcfi(/6/4!/2)')).toBe('/books/dune/read?at=epubcfi(%2F6%2F4!%2F2)');
	});
});
