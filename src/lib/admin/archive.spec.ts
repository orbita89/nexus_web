import { describe, expect, it } from 'vitest';
import { ApiError } from '#lib/api/errors.ts';
import { formatPopularity, originalTitle, promoteFailure } from './archive';

const doc = { kind: 'movie', slug: 'the-night-visitor-1971' } as const;

describe('originalTitle', () => {
	it('только если отличается от названия', () => {
		expect(originalTitle({ title: 'Ночной посетитель', original_title: 'The Night Visitor' })).toBe(
			'The Night Visitor'
		);
		expect(originalTitle({ title: 'Hamlet', original_title: 'hamlet ' })).toBeNull();
		expect(originalTitle({ title: 'Гамлет', original_title: null })).toBeNull();
		expect(originalTitle({ title: 'Гамлет', original_title: '' })).toBeNull();
	});
});

describe('formatPopularity', () => {
	it('одна цифра после запятой', () => {
		expect(formatPopularity(1.84)).toBe('1,8');
		expect(formatPopularity(3)).toBe('3,0');
	});
});

describe('promoteFailure', () => {
	it('404 — фильма уже нет, строку убрать', () => {
		const f = promoteFailure(new ApiError(404, 'not found', null, 'not_found'), doc);
		expect(f).toEqual({ message: 'Фильма уже нет в архиве', gone: true, siteHref: null });
	});

	it('409: уже на сайте — ссылка на карточку', () => {
		for (const text of ['slug is already taken', 'tmdb id is already in the catalog']) {
			const f = promoteFailure(new ApiError(409, text, null, 'conflict'), doc);
			expect(f.message).toBe('Уже есть на сайте');
			expect(f.siteHref).toBe('/films/the-night-visitor-1971');
			expect(f.gone).toBe(false);
		}
	});

	it('409: пересборка архива — повторить позже', () => {
		const f = promoteFailure(
			new ApiError(409, 'archive is being rebuilt, try again later', null, 'conflict'),
			doc
		);
		expect(f.message).toMatch(/пересобирается/);
		expect(f.siteHref).toBeNull();
	});

	it('503 и прочее', () => {
		expect(promoteFailure(new ApiError(503, null, null, 'unavailable'), doc).message).toBe(
			'Архив временно недоступен'
		);
		expect(promoteFailure(new ApiError(403, null, null, 'forbidden'), doc).message).toBe(
			'Недостаточно прав.'
		);
		expect(promoteFailure(new Error('boom'), doc).message).toMatch(/Нет связи/);
	});
});
