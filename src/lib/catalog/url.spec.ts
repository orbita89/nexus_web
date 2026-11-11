import { describe, expect, it } from 'vitest';
import {
	filterUrl,
	formUrl,
	MAX_MORE,
	moreUrl,
	pageLinks,
	pageUrl,
	readMore,
	readOffset,
	shownSize,
	readText,
	readYear,
	withQuery
} from './url';

const url = (s: string) => new URL(s, 'http://localhost');

describe('withQuery', () => {
	it('пропускает пустые значения и offset=0', () => {
		expect(withQuery('/films', { tag: 'sci-fi', year: '', q: '  ', offset: 0 })).toBe(
			'/films?tag=sci-fi'
		);
		expect(withQuery('/films', {})).toBe('/films');
		expect(withQuery('/films', { year: 2021, offset: 24 })).toBe('/films?year=2021&offset=24');
	});

	it('кодирует значения', () => {
		expect(withQuery('/search', { q: 'дюна & ко' })).toBe(
			'/search?q=%D0%B4%D1%8E%D0%BD%D0%B0+%26+%D0%BA%D0%BE'
		);
	});
});

describe('filterUrl', () => {
	it('меняет фильтр, сохраняет остальные и сбрасывает страницу', () => {
		const u = url('/films?tag=sci-fi&year=2021&offset=48');
		expect(filterUrl(u, { tag: 'drama' })).toBe('/films?tag=drama&year=2021');
		expect(filterUrl(u, { tag: null })).toBe('/films?year=2021');
	});
});

describe('formUrl', () => {
	it('отбрасывает пустые поля формы', () => {
		const form = new FormData();
		form.set('q', ' дюна ');
		form.set('tag', '');
		form.set('year', '');
		expect(formUrl('/films', form)).toBe('/films?q=%D0%B4%D1%8E%D0%BD%D0%B0');
	});
});

describe('pageUrl', () => {
	it('сохраняет фильтры', () => {
		expect(pageUrl(url('/films?tag=sci-fi'), 24)).toBe('/films?tag=sci-fi&offset=24');
		expect(pageUrl(url('/films?tag=sci-fi&offset=24'), 0)).toBe('/films?tag=sci-fi');
	});

	it('сбрасывает догруженные порции', () => {
		expect(pageUrl(url('/films?tag=sci-fi&more=3'), 24)).toBe('/films?tag=sci-fi&offset=24');
	});
});

describe('«Показать ещё» в адресе', () => {
	it('moreUrl сохраняет фильтры и страницу, more=0 не пишет', () => {
		expect(moreUrl(url('/films?tag=sci-fi&offset=24'), 2)).toBe(
			'/films?tag=sci-fi&offset=24&more=2'
		);
		expect(moreUrl(url('/films?tag=sci-fi&more=2'), 0)).toBe('/films?tag=sci-fi');
	});

	it('readMore: целое 0…MAX_MORE, мусор — 0', () => {
		expect(readMore(url('/films?more=3'))).toBe(3);
		expect(readMore(url('/films'))).toBe(0);
		expect(readMore(url('/films?more=-1'))).toBe(0);
		expect(readMore(url('/films?more=нет'))).toBe(0);
		expect(readMore(url(`/films?more=${MAX_MORE + 5}`))).toBe(MAX_MORE);
	});

	it('shownSize: первая порция плюс догруженные', () => {
		expect(shownSize(url('/films'))).toBe(24);
		expect(shownSize(url('/films?more=2'))).toBe(72);
	});

	it('новый фильтр сбрасывает догруженные порции', () => {
		expect(filterUrl(url('/films?tag=sci-fi&more=2'), { tag: 'drama' })).toBe('/films?tag=drama');
	});
});

describe('чтение адреса', () => {
	it('offset: целое ≥ 0, мусор — 0', () => {
		expect(readOffset(url('/films?offset=24'))).toBe(24);
		expect(readOffset(url('/films'))).toBe(0);
		expect(readOffset(url('/films?offset=-5'))).toBe(0);
		expect(readOffset(url('/films?offset=abc'))).toBe(0);
		expect(readOffset(url('/films?offset=2.5'))).toBe(0);
	});

	it('год: только четыре цифры', () => {
		expect(readYear(url('/films?year=2021'))).toBe(2021);
		expect(readYear(url('/films?year=21'))).toBeUndefined();
		expect(readYear(url('/films?year=abcd'))).toBeUndefined();
		expect(readYear(url('/films'))).toBeUndefined();
	});

	it('текст: пустая строка — undefined', () => {
		expect(readText(url('/films?q=%20'), 'q')).toBeUndefined();
		expect(readText(url('/films?q=%20dune'), 'q')).toBe('dune');
	});
});

describe('pageLinks', () => {
	const numbers = (links: ReturnType<typeof pageLinks>) =>
		links.map((l) => (l ? (l.current ? `[${l.number}]` : String(l.number)) : '…')).join(' ');

	it('одна страница', () => {
		expect(numbers(pageLinks(0, 24, 0))).toBe('[1]');
		expect(numbers(pageLinks(24, 24, 0))).toBe('[1]');
	});

	it('мало страниц — все подряд', () => {
		expect(numbers(pageLinks(100, 24, 0))).toBe('[1] 2 3 4 5');
		expect(numbers(pageLinks(100, 24, 48))).toBe('1 2 [3] 4 5');
	});

	it('много страниц — пропуски', () => {
		expect(numbers(pageLinks(240, 24, 96))).toBe('1 … 4 [5] 6 … 10');
		expect(numbers(pageLinks(240, 24, 0))).toBe('[1] 2 … 10');
		expect(numbers(pageLinks(240, 24, 216))).toBe('1 … 9 [10]');
	});

	it('offset страницы и выход за конец', () => {
		const links = pageLinks(50, 24, 1000);
		expect(numbers(links)).toBe('1 2 [3]');
		expect(links.at(-1)).toMatchObject({ number: 3, offset: 48 });
	});
});
