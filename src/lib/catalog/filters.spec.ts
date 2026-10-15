import { describe, expect, it } from 'vitest';
import {
	hasFilters,
	readArchive,
	readFilters,
	readMode,
	searchSortParam,
	yearLabel
} from './filters';

const at = (qs: string) => new URL(`http://x/films${qs}`);

describe('readFilters', () => {
	it('всё из адреса; роль — только при человеке и из списка', () => {
		const f = readFilters(at('?q=дюна&studio=Pixar&person=nolan&role=director&year=2014'));
		expect(f).toEqual({
			q: 'дюна',
			tag: undefined,
			year: 2014,
			yearFrom: undefined,
			yearTo: undefined,
			studio: 'Pixar',
			person: 'nolan',
			role: 'director'
		});
		expect(readFilters(at('?role=director')).role).toBeUndefined();
		expect(readFilters(at('?person=nolan&role=hacker')).role).toBeUndefined();
		// Архив выключен по умолчанию, включается только archive=1.
		expect(readArchive(at(''))).toBe(false);
		expect(readArchive(at('?archive=1'))).toBe(true);
		expect(readArchive(at('?archive=0'))).toBe(false);
		expect(readArchive(at('?archive=yes'))).toBe(false);
	});

	it('фильтры: архив — не фильтр', () => {
		expect(hasFilters(readFilters(at('?studio=Pixar')))).toBe(true);
		expect(hasFilters(readFilters(at('')))).toBe(false);
		expect(hasFilters(readFilters(at('?archive=1')))).toBe(false);
	});
});

describe('год', () => {
	it('ровно или период; период важнее', () => {
		const range = readFilters(at('?year=2014&year_from=2000&year_to=2010'));
		expect(range).toMatchObject({ year: undefined, yearFrom: 2000, yearTo: 2010 });
		expect(yearLabel(range)).toBe('2000–2010');
		expect(yearLabel({ yearFrom: 2000 })).toBe('с 2000');
		expect(yearLabel({ yearTo: 1999 })).toBe('до 1999');
		expect(yearLabel({ year: 2014 })).toBe('2014');
	});
});

describe('readMode', () => {
	it('у поиска по умолчанию — релевантность, чужой порядок сбрасывается', () => {
		const url = at('?q=дюна&sort=hacker');
		const mode = readMode(url, readFilters(url));
		expect(mode).toMatchObject({ sort: 'relevance', fallback: 'relevance' });
		expect(searchSortParam('relevance')).toBeUndefined();
		const top = at('?q=дюна&sort=top_rated');
		expect(readMode(top, readFilters(top)).sort).toBe('top_rated');
	});

	it('без текста — без релевантности, по умолчанию «Рекомендуемые» (и со студией, и с человеком)', () => {
		const url = at('?sort=relevance&studio=Pixar');
		const mode = readMode(url, readFilters(url));
		expect(mode).toMatchObject({ sort: 'recommended', fallback: 'recommended' });
		expect(mode.options.map((o) => o.value)).not.toContain('relevance');
	});
});
