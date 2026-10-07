import { describe, expect, it } from 'vitest';
import {
	detectProvider,
	emptyMetadataForm,
	fromMetadata,
	metadataError,
	splitList,
	toMetadata
} from './entity-form';

const form = (o: Partial<ReturnType<typeof emptyMetadataForm>>) => ({
	...emptyMetadataForm(),
	...o
});

describe('splitList', () => {
	it('запятые и пробелы, регистр, без повторов', () => {
		expect(splitList('US, ca  GB;us', true)).toEqual(['US', 'CA', 'GB']);
		expect(splitList('PC, ps5 xbox-series')).toEqual(['pc', 'ps5', 'xbox-series']);
		expect(splitList('  ')).toEqual([]);
	});
});

describe('detectProvider', () => {
	it.each([
		['https://www.youtube.com/watch?v=n9xhJrPXop4', 'youtube'],
		['youtu.be/n9xhJrPXop4', 'youtube'],
		['https://rutube.ru/video/0ab1fc1e47f2e9b89e9e59d9db36f2b4/', 'rutube'],
		['n9xhJrPXop4', null],
		['https://vimeo.com/1', null]
	])('%s → %s', (text, provider) => expect(detectProvider(text)).toBe(provider));
});

describe('toMetadata', () => {
	it('фильм: только свои и заполненные поля, числа, страны, трейлеры', () => {
		expect(
			toMetadata(
				'movie',
				form({
					runtime_min: '155',
					countries: 'us, ca',
					age_rating: ' PG-13 ',
					pages: '999',
					trailers: [
						{ provider: 'youtube', id: ' n9xhJrPXop4 ' },
						{ provider: 'rutube', id: '' }
					]
				})
			)
		).toEqual({
			runtime_min: 155,
			countries: ['US', 'CA'],
			age_rating: 'PG-13',
			trailers: [{ provider: 'youtube', id: 'n9xhJrPXop4' }]
		});
	});

	it('сериал, книга, игра', () => {
		expect(toMetadata('series', form({ seasons: '4', status: 'ended' }))).toEqual({
			seasons: 4,
			status: 'ended'
		});
		expect(toMetadata('book', form({ isbn: '978-0-441-01359-3', pages: '896' }))).toEqual({
			isbn: '9780441013593',
			pages: 896
		});
		expect(toMetadata('game', form({ platforms: 'pc, PS5', developer: 'CDPR' }))).toEqual({
			platforms: ['pc', 'ps5'],
			developer: 'CDPR'
		});
	});

	it('пустая форма — пустая metadata', () => {
		expect(toMetadata('movie', emptyMetadataForm())).toEqual({});
	});
});

describe('fromMetadata', () => {
	it('туда и обратно', () => {
		const metadata = {
			runtime_min: 155,
			countries: ['US', 'CA'],
			age_rating: 'PG-13',
			trailers: [{ provider: 'youtube' as const, id: 'n9xhJrPXop4' }]
		};
		const f = fromMetadata('movie', metadata);
		expect(f.runtime_min).toBe('155');
		expect(f.countries).toBe('US, CA');
		expect(toMetadata('movie', f)).toEqual(metadata);
	});

	it('у книги трейлеров нет', () => {
		expect(fromMetadata('book', { pages: 10 }).trailers).toEqual([]);
	});
});

describe('metadataError', () => {
	it('диапазоны, страны, лимит трейлеров', () => {
		expect(metadataError('movie', form({ runtime_min: '155', countries: 'US' }))).toBeNull();
		expect(metadataError('movie', form({ runtime_min: '0' }))).toMatch(/Длительность/);
		expect(metadataError('movie', form({ runtime_min: '1.5' }))).toMatch(/целое/);
		expect(metadataError('movie', form({ countries: 'USA' }))).toMatch(/Страны/);
		expect(metadataError('series', form({ episodes: '100001' }))).toMatch(/Эпизоды/);
		expect(metadataError('book', form({ pages: 'много' }))).toMatch(/Страниц/);
		const trailers = Array.from({ length: 6 }, () => ({ provider: 'youtube' as const, id: 'x' }));
		expect(metadataError('game', form({ trailers }))).toMatch(/5/);
	});
});
