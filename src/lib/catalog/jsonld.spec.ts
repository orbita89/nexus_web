import { describe, expect, it } from 'vitest';
import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
import { entityJsonLd, jsonLdScript } from './jsonld.ts';

const book = {
	kind: 'book',
	title: 'Белая гвардия',
	slug: 'belaya-gvardiya',
	cover_url: 'https://x/c.jpg',
	release_date: '1925-01-01',
	description: 'Роман',
	metadata: { isbn: '978-5', language: 'ru', pages: 320 },
	credits: [
		{ role: 'author', person: { full_name: 'Михаил Булгаков', slug: 'mikhail-bulgakov' } },
		{ role: 'translator', person: { full_name: 'X', slug: 'x' } }
	]
} as unknown as SchemaEntityDetail;

describe('entityJsonLd', () => {
	it('книга — schema.org Book с автором и ISBN', () => {
		const ld = entityJsonLd(book, 'https://k/books/belaya-gvardiya', 'https://k')!;
		expect(ld['@type']).toBe('Book');
		expect(ld.isbn).toBe('978-5');
		expect(ld.inLanguage).toBe('ru');
		expect(ld.author).toEqual([
			{ '@type': 'Person', name: 'Михаил Булгаков', url: 'https://k/people/mikhail-bulgakov' }
		]);
		expect('publisher' in ld).toBe(false);
	});

	it('не книга — без разметки', () => {
		expect(entityJsonLd({ ...book, kind: 'movie' }, 'u', 'o')).toBeNull();
	});

	it('экранирует </script>', () => {
		expect(jsonLdScript({ d: '</script>' })).not.toContain('</script><');
		expect(jsonLdScript({ d: '</script>' })).toContain('\\u003c/script>');
	});
});
