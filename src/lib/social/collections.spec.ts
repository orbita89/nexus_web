import { describe, expect, it } from 'vitest';
import { collectionFormError, moveItem } from './collections';

describe('форма коллекции', () => {
	it('название обязательно и до 200 символов, описание до 2000', () => {
		expect(collectionFormError({ title: 'Лучшая фантастика', description: '' })).toBeNull();
		expect(collectionFormError({ title: '  ', description: '' })).toMatch(/название/);
		expect(collectionFormError({ title: 'x'.repeat(201), description: '' })).toMatch(/200/);
		expect(collectionFormError({ title: 'x', description: 'y'.repeat(2001) })).toMatch(/2000/);
	});
});

describe('moveItem', () => {
	const list = ['a', 'b', 'c', 'd'];
	it('вниз, вверх, на место и за край', () => {
		expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
		expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
		expect(moveItem(list, 1, 1)).toEqual(list);
		expect(moveItem(list, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
		expect(moveItem(list, 9, 0)).toEqual(list);
	});

	it('исходный массив не меняется', () => {
		const copy = [...list];
		moveItem(list, 0, 3);
		expect(list).toEqual(copy);
	});
});
