import { describe, expect, it } from 'vitest';
import { hasFilters, isSearch, readFilters, readMode, searchSortParam } from './filters';

const at = (qs: string) => new URL(`http://x/films${qs}`);

describe('readFilters', () => {
	it('всё из адреса; роль — только при человеке и из списка', () => {
		const f = readFilters(
			at('?q=дюна&studio=Pixar&person=nolan&role=director&archive=1&year=2014')
		);
		expect(f).toEqual({
			q: 'дюна',
			tag: undefined,
			year: 2014,
			studio: 'Pixar',
			person: 'nolan',
			role: 'director',
			archive: true
		});
		expect(readFilters(at('?role=director')).role).toBeUndefined();
		expect(readFilters(at('?person=nolan&role=hacker')).role).toBeUndefined();
		expect(readFilters(at('?archive=yes')).archive).toBe(false);
	});

	it('поиск — при тексте, студии или человеке; тег и год — обычный список', () => {
		expect(isSearch(readFilters(at('?tag=drama&year=2014')))).toBe(false);
		expect(isSearch(readFilters(at('?studio=Pixar')))).toBe(true);
		expect(isSearch(readFilters(at('?person=nolan')))).toBe(true);
		expect(hasFilters(readFilters(at('')))).toBe(false);
		expect(hasFilters(readFilters(at('?archive=1')))).toBe(true);
	});
});

describe('readMode', () => {
	it('у поиска по умолчанию — релевантность, чужой порядок сбрасывается', () => {
		const url = at('?q=дюна&sort=popular');
		const mode = readMode(url, readFilters(url));
		expect(mode.search).toBe(true);
		expect(mode.sort).toBe('relevance');
		expect(searchSortParam('relevance')).toBeUndefined();
		const top = at('?q=дюна&sort=top_rated');
		expect(readMode(top, readFilters(top)).sort).toBe('top_rated');
	});

	it('у списка — свои порядки, по умолчанию «новые»', () => {
		const url = at('?sort=relevance');
		const mode = readMode(url, readFilters(url));
		expect(mode).toMatchObject({ search: false, sort: 'new' });
	});
});
