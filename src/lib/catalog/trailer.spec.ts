import { describe, expect, it } from 'vitest';
import { trailerUrl } from './trailer';

describe('trailerUrl', () => {
	it('фильм, сериал, игра — адрес из trailer_url', () => {
		expect(trailerUrl({ kind: 'movie', trailer_url: 'https://cdn.example/t.mp4' } as never)).toBe(
			'https://cdn.example/t.mp4'
		);
		expect(trailerUrl({ kind: 'series', trailer_url: '/media/t.webm' } as never)).toBe(
			'/media/t.webm'
		);
		expect(trailerUrl({ kind: 'game', trailer_url: 'http://x/t.mp4' } as never)).toBe(
			'http://x/t.mp4'
		);
	});

	it('нет поля, пусто или чужая схема — null', () => {
		expect(trailerUrl({ kind: 'movie' })).toBeNull();
		expect(trailerUrl({ kind: 'movie', trailer_url: null } as never)).toBeNull();
		expect(trailerUrl({ kind: 'movie', trailer_url: '' } as never)).toBeNull();
		expect(trailerUrl({ kind: 'movie', trailer_url: 'javascript:alert(1)' } as never)).toBeNull();
		expect(trailerUrl({ kind: 'movie', trailer_url: '//evil.example/t.mp4' } as never)).toBeNull();
	});

	it('у книг трейлера нет', () => {
		expect(
			trailerUrl({ kind: 'book', trailer_url: 'https://cdn.example/t.mp4' } as never)
		).toBeNull();
	});
});
