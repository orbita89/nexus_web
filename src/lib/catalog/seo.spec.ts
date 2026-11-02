import { describe, expect, it } from 'vitest';
import { canonicalUrl } from './seo';

const at = (path: string) => new URL(path, 'http://localhost');
const canonical = (path: string) => canonicalUrl(at(path), 'https://nexus.example');

describe('canonicalUrl', () => {
	it('порядок, страница, архив и метки отбрасываются', () => {
		expect(canonical('/films?sort=new&offset=24&archive=1&utm_source=vk')).toBe(
			'https://nexus.example/films'
		);
		expect(canonical('/paintings/the-night-watch')).toBe(
			'https://nexus.example/paintings/the-night-watch'
		);
	});

	it('раздел и тег остаются: это самостоятельные страницы', () => {
		expect(canonical('/tags/sci-fi?kind=films&offset=48')).toBe(
			'https://nexus.example/tags/sci-fi?kind=films'
		);
		expect(canonical('/films?tag=drama&sort=title')).toBe('https://nexus.example/films?tag=drama');
		// Порядок параметров в каноническом адресе всегда один: kind, затем tag.
		expect(canonical('/search?tag=drama&kind=books')).toBe(
			'https://nexus.example/search?kind=books&tag=drama'
		);
	});

	it('пустые значения не попадают в адрес', () => {
		expect(canonical('/films?tag=&kind=%20')).toBe('https://nexus.example/films');
	});
});
