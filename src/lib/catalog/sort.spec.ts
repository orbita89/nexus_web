import { describe, expect, it } from 'vitest';
import { readEntitySort } from './sort';

describe('readEntitySort', () => {
	it('из адреса; неизвестная или нет — «новые»', () => {
		expect(readEntitySort(new URL('http://x/films?sort=rating'))).toBe('rating');
		expect(readEntitySort(new URL('http://x/films?sort=popular'))).toBe('popular');
		expect(readEntitySort(new URL('http://x/films?sort=hacker'))).toBe('recommended');
		expect(readEntitySort(new URL('http://x/films'))).toBe('recommended');
	});
});
