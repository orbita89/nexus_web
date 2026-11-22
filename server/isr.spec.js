import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
	acceptsBrotli,
	minifyHtml,
	pathOfFile,
	publish,
	publishBrotli,
	staticFiles
} from './isr.js';

describe('staticFiles', () => {
	it('книги — по папкам из двух первых символов slug, адрес не меняется', () => {
		expect(staticFiles('/books/belaya-gvardiya')).toEqual({
			html: '/books/be/belaya-gvardiya.html',
			data: '/books/be/belaya-gvardiya/__data.json'
		});
	});

	it('остальные разделы — как были', () => {
		expect(staticFiles('/films/dune-2021')).toEqual({
			html: '/films/dune-2021.html',
			data: '/films/dune-2021/__data.json'
		});
		expect(staticFiles('/awards/oscar/2024').html).toBe('/awards/oscar/2024.html');
	});

	it('pathOfFile — обратное преобразование', () => {
		expect(pathOfFile('/books/be/belaya-gvardiya.html')).toBe('/books/belaya-gvardiya');
		expect(pathOfFile('/books/be/belaya-gvardiya.html.br')).toBe('/books/belaya-gvardiya');
		expect(pathOfFile('/films/dune-2021.html')).toBe('/films/dune-2021');
		expect(pathOfFile('/awards/oscar/2024.html')).toBe('/awards/oscar/2024');
	});
});

describe('minifyHtml', () => {
	it('сжимает пробелы, но сохраняет метки гидрации Svelte', async () => {
		const html = '<div>\n    <!--[-->\n    <p>  Белая   гвардия </p>\n    <!--]-->\n</div>';
		const out = await minifyHtml(html);
		expect(out).toContain('<!--[-->');
		expect(out).toContain('<!--]-->');
		expect(out.length).toBeLessThan(html.length);
		expect(out).not.toMatch(/\s{2,}/);
	});
});

describe('minifyHtml: значимые переносы', () => {
	it('абзацы в whitespace-pre-line не склеиваются', async () => {
		const html = '<div>  <p class="leading-7 whitespace-pre-line">Абзац 1.\n\nАбзац 2.</p>  </div>';
		expect(await minifyHtml(html)).toContain('Абзац 1.\n\nАбзац 2.');
	});
});

describe('acceptsBrotli', () => {
	it('br в списке — да, q=0 или нет br — нет', () => {
		expect(acceptsBrotli('gzip, deflate, br, zstd')).toBe(true);
		expect(acceptsBrotli('br;q=0.5')).toBe(true);
		expect(acceptsBrotli('gzip, br;q=0')).toBe(false);
		expect(acceptsBrotli('gzip, deflate')).toBe(false);
		expect(acceptsBrotli(undefined)).toBe(false);
	});
});

describe('publish', () => {
	it('пишет файл, .br и .gz; неизменённое не перезаписывает', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'isr-'));
		const file = join(dir, 'films/dune-2021.html');
		expect(await publish(file, '<p>a</p>')).toBe(true);
		expect(await readFile(file, 'utf8')).toBe('<p>a</p>');
		expect((await stat(`${file}.br`)).size).toBeGreaterThan(0);
		expect((await stat(`${file}.gz`)).size).toBeGreaterThan(0);
		const before = (await stat(file)).mtimeMs;
		expect(await publish(file, '<p>a</p>')).toBe(false);
		expect((await stat(file)).mtimeMs).toBe(before);
	});
});

describe('publishBrotli', () => {
	it('книга — только .br; сравнение с распакованным; старые несжатые удаляет', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'isr-'));
		const file = join(dir, 'books/be/belaya-gvardiya.html');
		await publish(file, '<p>old</p>');
		expect(await publishBrotli(file, '<p>a</p>')).toBe(true);
		expect(brotliDecompressSync(await readFile(`${file}.br`)).toString()).toBe('<p>a</p>');
		await expect(stat(file)).rejects.toThrow();
		await expect(stat(`${file}.gz`)).rejects.toThrow();

		const before = (await stat(`${file}.br`)).mtimeMs;
		expect(await publishBrotli(file, '<p>a</p>')).toBe(false);
		expect((await stat(`${file}.br`)).mtimeMs).toBe(before);
		expect(await publishBrotli(file, '<p>b</p>')).toBe(true);
	});
});
