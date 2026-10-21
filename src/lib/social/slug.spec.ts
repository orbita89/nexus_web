import { describe, expect, it } from 'vitest';
import { buildFeaturedUrl } from './featured.ts';
import { isUuid, slugError, slugify } from './slug.ts';

describe('slugify', () => {
	it('транслитерирует кириллицу', () => {
		expect(slugify('Русский топ 2021')).toBe('russkiy-top-2021');
		expect(slugify('Щука, ёж и чайка!')).toBe('shchuka-ezh-i-chayka');
	});
	it('чистит лишние символы и дефисы', () => {
		expect(slugify('  Top-10: «Лучшие» фильмы  ')).toBe('top-10-luchshie-filmy');
		expect(slugify('Café déjà vu')).toBe('cafe-deja-vu');
		expect(slugify('!!!')).toBe('');
	});
	it('обрезает до 100 символов без хвостового дефиса', () => {
		const s = slugify('а'.repeat(99) + ' б');
		expect(s.length).toBeLessThanOrEqual(100);
		expect(s.endsWith('-')).toBe(false);
	});
});

describe('slugError', () => {
	it('принимает корректный адрес', () => {
		expect(slugError('russkiy-top-2021')).toBeNull();
		expect(slugError('abc')).toBeNull();
	});
	it('длина 3–100', () => {
		expect(slugError('ab')).not.toBeNull();
		expect(slugError('a'.repeat(101))).not.toBeNull();
		expect(slugError('a'.repeat(100))).toBeNull();
	});
	it('формат', () => {
		for (const bad of ['Top-10', '-abc', 'abc-', 'a--b', 'a_b', 'тест']) {
			expect(slugError(bad)).not.toBeNull();
		}
	});
	it('не UUID и не служебные слова', () => {
		expect(slugError('123e4567-e89b-12d3-a456-426614174000')).not.toBeNull();
		for (const w of ['featured', 'new', 'by-slug', 'admin', 'create', 'edit', 'search']) {
			expect(slugError(w)).not.toBeNull();
		}
	});
	it('isUuid', () => {
		expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
		expect(isUuid('russkiy-top-2021')).toBe(false);
	});
});

describe('buildFeaturedUrl', () => {
	const id = '123e4567-e89b-12d3-a456-426614174000';
	it('slug, если есть', () => {
		expect(buildFeaturedUrl({ id, slug: 'russkiy-top-2021', is_featured: true })).toBe(
			'/collections/russkiy-top-2021'
		);
	});
	it('иначе id', () => {
		expect(buildFeaturedUrl({ id, slug: null, is_featured: true })).toBe(`/collections/${id}`);
		expect(buildFeaturedUrl({ id, slug: 'old', is_featured: false })).toBe(`/collections/${id}`);
	});
});
