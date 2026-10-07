import { describe, expect, it } from 'vitest';
import type { SchemaPost } from '#lib/api/generated/social.ts';
import {
	canCreateThreads,
	excerpt,
	lastPageOffset,
	linkify,
	quoteFor,
	readThreadSort,
	threadFormError,
	threadSortParam,
	timeAgo
} from './forum';

const url = (s: string) => new URL(s, 'http://localhost');
const user = (username: string) => ({ id: username, username });
const post = (o: Partial<SchemaPost> & { id: string }): SchemaPost => ({
	thread_id: 't',
	deleted: false,
	created_at: '2026-10-07T10:00:00Z',
	...o
});

describe('сортировка тем', () => {
	it('по умолчанию активные, в адрес не пишутся', () => {
		expect(readThreadSort(url('/forum'))).toBe('active');
		expect(readThreadSort(url('/forum?sort=new'))).toBe('new');
		expect(readThreadSort(url('/forum?sort=x'))).toBe('active');
		expect(threadSortParam('active')).toBeNull();
		expect(threadSortParam('new')).toBe('new');
	});
});

describe('последняя страница', () => {
	it('новое сообщение — на последней странице', () => {
		expect(lastPageOffset(0, 50)).toBe(0);
		expect(lastPageOffset(1, 50)).toBe(0);
		expect(lastPageOffset(50, 50)).toBe(0);
		expect(lastPageOffset(51, 50)).toBe(50);
		expect(lastPageOffset(101, 50)).toBe(100);
	});
});

describe('права и форма', () => {
	it('темы создают author и admin', () => {
		expect(canCreateThreads('author')).toBe(true);
		expect(canCreateThreads('admin')).toBe(true);
		expect(canCreateThreads('user')).toBe(false);
		expect(canCreateThreads(undefined)).toBe(false);
	});

	it('проверка формы темы', () => {
		const ok = { title: 'Дюна', body: 'Текст', entities: ['dune-2021'] };
		expect(threadFormError(ok)).toBeNull();
		expect(threadFormError({ ...ok, title: '  ' })).toMatch(/заголовок/);
		expect(threadFormError({ ...ok, title: 'x'.repeat(201) })).toMatch(/200/);
		expect(threadFormError({ ...ok, body: '' })).toMatch(/текст/);
		expect(threadFormError({ ...ok, entities: [] })).toMatch(/произведение/);
		expect(threadFormError({ ...ok, entities: Array(11).fill('x') })).toMatch(/10/);
	});
});

describe('цитата над ответом', () => {
	const root = post({ id: 'a', author: user('user'), body: 'У Херберта Пол мрачнее.' });

	it('ответ на тему — без цитаты', () => {
		expect(quoteFor(root, [root])).toBeNull();
	});

	it('исходное на странице — автор, начало текста, ссылка', () => {
		const reply = post({ id: 'b', parent_id: 'a', reply_to: user('user'), body: 'Согласен' });
		expect(quoteFor(reply, [root, reply])).toEqual({
			targetId: 'a',
			author: 'user',
			excerpt: 'У Херберта Пол мрачнее.'
		});
	});

	it('исходное на другой странице — только автор', () => {
		const reply = post({ id: 'b', parent_id: 'zzz', reply_to: user('admin') });
		expect(quoteFor(reply, [reply])).toEqual({ targetId: null, author: 'admin', excerpt: null });
	});

	it('исходное удалено — «на удалённое сообщение»', () => {
		const gone = post({ id: 'a', deleted: true, author: null, body: null });
		const reply = post({ id: 'b', parent_id: 'a', reply_to: null });
		expect(quoteFor(reply, [gone, reply])).toEqual({
			targetId: 'a',
			author: null,
			excerpt: null
		});
	});

	it('начало текста обрезается по слову', () => {
		expect(excerpt('слово '.repeat(30), 20)).toBe('слово слово слово…');
		expect(excerpt('коротко\nи ясно')).toBe('коротко и ясно');
	});
});

describe('linkify', () => {
	it('адреса — ссылки, остальное — текст; точка в конце не в адресе', () => {
		expect(linkify('См. https://ru.wikipedia.org/wiki/Дюна. И всё')).toEqual([
			{ text: 'См. ' },
			{ href: 'https://ru.wikipedia.org/wiki/Дюна', text: 'https://ru.wikipedia.org/wiki/Дюна' },
			{ text: '. И всё' }
		]);
	});

	it('без адресов и не-http — как есть', () => {
		expect(linkify('просто текст')).toEqual([{ text: 'просто текст' }]);
		expect(linkify('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }]);
	});

	it('адрес в скобках и «ёлочках»', () => {
		expect(linkify('(http://a.ru/x)')).toEqual([
			{ text: '(' },
			{ href: 'http://a.ru/x', text: 'http://a.ru/x' },
			{ text: ')' }
		]);
		expect(linkify('«https://a.ru»')[1]).toEqual({ href: 'https://a.ru', text: 'https://a.ru' });
	});
});

describe('timeAgo', () => {
	const now = Date.parse('2026-10-07T12:00:00Z');
	const ago = (s: number) => new Date(now - s * 1000).toISOString();
	it.each([
		[10, 'только что'],
		[5 * 60, '5 минут назад'],
		[61 * 60, '1 час назад'],
		[3 * 3600, '3 часа назад'],
		[25 * 3600, 'вчера'],
		[3 * 86400, '3 дня назад']
	])('%i с → %s', (s, text) => expect(timeAgo(ago(s), now)).toBe(text));

	it('старше недели — дата', () => {
		expect(timeAgo('2026-09-01T12:00:00Z', now)).toMatch(/^1 сентября 2026/);
	});
});
