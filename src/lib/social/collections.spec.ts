import { describe, expect, it } from 'vitest';
import { ApiError } from '#lib/api/errors.ts';
import { styleUrlError } from './featuredThemes';
import {
	collectionFormError,
	editsAsAdmin,
	featuredAdminError,
	isFeaturedMustBePublic,
	moveItem,
	validationField
} from './collections';

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

describe('админ и оформление особых', () => {
	const err = (status: number, code: string | null, field: string | null = null) =>
		new ApiError(status, 'x', null, code, field);
	const fallback = () => 'fallback';

	it('ошибки по code', () => {
		expect(featuredAdminError(err(400, 'collection_private'), fallback)).toMatch(/публичной/);
		expect(featuredAdminError(err(400, 'not_featured'), fallback)).toMatch(/не особая/);
		expect(featuredAdminError(err(403, 'forbidden'), fallback)).toMatch(/прав/);
		expect(featuredAdminError(err(409, 'conflict'), fallback)).toMatch(/занят/);
		expect(isFeaturedMustBePublic(err(400, 'collection_private'))).toBe(true);
		expect(validationField(err(400, 'validation', 'cover_url'))).toBe('cover_url');
		expect(validationField(err(400, 'not_featured'))).toBeNull();
	});

	it('админские пути — только в чужой особой', () => {
		const c = { is_featured: true, owner: { id: 'o' } } as never;
		expect(editsAsAdmin(c, { id: 'a', role: 'admin' })).toBe(true);
		expect(editsAsAdmin(c, { id: 'o', role: 'admin' })).toBe(false);
		expect(editsAsAdmin(c, { id: 'a', role: 'user' })).toBe(false);
		expect(
			editsAsAdmin({ is_featured: false, owner: { id: 'o' } } as never, { id: 'a', role: 'admin' })
		).toBe(false);
	});

	it('URL оформления: https и до 2048', () => {
		expect(styleUrlError('')).toBeNull();
		expect(styleUrlError('https://cdn.example.com/a.jpg')).toBeNull();
		expect(styleUrlError('http://cdn.example.com/a.jpg')).toMatch(/https/);
		expect(styleUrlError(`https://e.com/${'a'.repeat(2040)}`)).toMatch(/2048/);
	});
});
