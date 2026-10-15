import { describe, expect, it } from 'vitest';
import { readListSort } from './sort';

describe('readListSort', () => {
	it('из адреса; неизвестный, по оценкам Nexus (их нет в поиске) или нет — «Рекомендуемые»', () => {
		expect(readListSort(new URL('http://x/films?sort=top_rated'))).toBe('top_rated');
		expect(readListSort(new URL('http://x/films?sort=rating'))).toBe('recommended');
		expect(readListSort(new URL('http://x/films?sort=popular'))).toBe('recommended');
		expect(readListSort(new URL('http://x/films?sort=hacker'))).toBe('recommended');
		expect(readListSort(new URL('http://x/films'))).toBe('recommended');
	});
});
