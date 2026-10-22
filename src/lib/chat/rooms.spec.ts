import { describe, expect, it } from 'vitest';
import { activityLabel, entityLink, parseBody } from './rooms.ts';

describe('parseBody', () => {
	it('упоминание в начале, середине и несколько подряд', () => {
		expect(parseBody('@anton привет')).toEqual([
			{ t: 'mention', v: 'anton' },
			{ t: 'text', v: ' привет' }
		]);
		expect(parseBody('привет, @anton!')).toEqual([
			{ t: 'text', v: 'привет, ' },
			{ t: 'mention', v: 'anton' },
			{ t: 'text', v: '!' }
		]);
		expect(parseBody('@a @b')).toEqual([
			{ t: 'mention', v: 'a' },
			{ t: 'text', v: ' ' },
			{ t: 'mention', v: 'b' }
		]);
	});

	it('не упоминание внутри слова и в почте', () => {
		expect(parseBody('почта me@example')).toEqual([{ t: 'text', v: 'почта me@example' }]);
		expect(parseBody('цена 10@20')).toEqual([{ t: 'text', v: 'цена 10@20' }]);
		expect(parseBody('@@anton')).toEqual([{ t: 'text', v: '@@anton' }]);
	});

	it('пустой текст и текст без упоминаний', () => {
		expect(parseBody('')).toEqual([]);
		expect(parseBody('обычное сообщение')).toEqual([{ t: 'text', v: 'обычное сообщение' }]);
	});
});

describe('entityLink', () => {
	it('находит ссылку на карточку любого раздела', () => {
		expect(entityLink('/films/dune-2021')).toEqual({ kind: 'movie', slug: 'dune-2021' });
		expect(entityLink('смотрите /series/severance вот')).toEqual({
			kind: 'series',
			slug: 'severance'
		});
		expect(entityLink('https://nexus.app/books/dune')).toEqual({ kind: 'book', slug: 'dune' });
		expect(entityLink('(/games/portal-2)')).toEqual({ kind: 'game', slug: 'portal-2' });
	});

	it('пропускает чужие и неполные ссылки', () => {
		expect(entityLink('/people/denis-villeneuve')).toBeNull();
		expect(entityLink('/films/')).toBeNull();
		expect(entityLink('префикс/films/dune')).toBeNull();
		expect(entityLink('без ссылок')).toBeNull();
	});
});

describe('activityLabel', () => {
	const now = Date.parse('2026-10-22T12:00:00Z');

	it('тихо — без метки', () => {
		expect(activityLabel({}, now)).toBeNull();
		expect(activityLabel({ messages_24h: 0, last_message_at: null }, now)).toBeNull();
	});

	it('сообщение за последний час — «сейчас пишут»', () => {
		expect(activityLabel({ messages_24h: 3, last_message_at: '2026-10-22T11:30:00Z' }, now)).toBe(
			'сейчас пишут'
		);
	});

	it('активность за сутки — счётчик', () => {
		expect(activityLabel({ messages_24h: 12, last_message_at: '2026-10-22T03:00:00Z' }, now)).toBe(
			'12 за сутки'
		);
		expect(activityLabel({ messages_24h: 5 }, now)).toBe('5 за сутки');
	});
});
