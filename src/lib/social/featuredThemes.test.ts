import { describe, expect, it } from 'vitest';
import { headerMode } from './featuredThemes.ts';

describe('headerMode', () => {
	it('uses header_mode from the backend', () => {
		expect(headerMode({ header_mode: 'styled' })).toBe('styled');
		expect(headerMode({ header_mode: 'plain' })).toBe('plain');
		expect(headerMode({ header_mode: 'none' })).toBe('none');
	});
	it('falls back to styled for an unknown value', () => {
		expect(headerMode({ header_mode: 'fancy' })).toBe('styled');
		expect(headerMode({ header_mode: '' })).toBe('styled');
	});
});
