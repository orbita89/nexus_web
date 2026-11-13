import { describe, expect, it } from 'vitest';
import {
	journalActionLabel,
	matchesFilter,
	matchesKind,
	matchesQuery,
	readJournalParams,
	type JournalItem
} from './journal.ts';

const item = (over: Partial<JournalItem> = {}, title = 'Дюна', kind = 'movie'): JournalItem => ({
	entity: { id: '1', kind, slug: 'dune', title },
	actions: ['like', 'rating'],
	last_activity_at: '2026-01-01T00:00:00Z',
	...over
});

describe('matchesFilter', () => {
	it('«Все» пропускает любую запись', () => {
		expect(matchesFilter(item(), 'all')).toBe(true);
	});
	it('«Лайки» — только записи с лайком', () => {
		expect(matchesFilter(item(), 'likes')).toBe(true);
		expect(matchesFilter(item({ actions: ['rating'] }), 'likes')).toBe(false);
	});
	it('«Рецензии», «Заметки», «Позже» и «Оценки» смотрят на свои действия', () => {
		const full = item({ actions: ['review', 'note', 'later', 'rating'] });
		for (const f of ['reviews', 'notes', 'later', 'ratings'] as const) {
			expect(matchesFilter(full, f)).toBe(true);
			expect(matchesFilter(item({ actions: ['like'] }), f)).toBe(false);
		}
	});
});

describe('matchesKind', () => {
	it('без типа пропускает всё', () => {
		expect(matchesKind(item(), undefined)).toBe(true);
	});
	it('сравнивает тип произведения', () => {
		expect(matchesKind(item(), 'movie')).toBe(true);
		expect(matchesKind(item(), 'book')).toBe(false);
	});
});

describe('matchesQuery', () => {
	it('пустой запрос пропускает всё', () => {
		expect(matchesQuery(item(), '')).toBe(true);
		expect(matchesQuery(item(), undefined)).toBe(true);
	});
	it('не зависит от регистра', () => {
		expect(matchesQuery(item(), 'дЮн')).toBe(true);
	});
	it('«ё» и «е» равны', () => {
		expect(matchesQuery(item({}, 'Ёжик в тумане'), 'ежик')).toBe(true);
		expect(matchesQuery(item({}, 'Ежик'), 'ёжик')).toBe(true);
	});
	it('не находит чужое название', () => {
		expect(matchesQuery(item(), 'матрица')).toBe(false);
	});
});

describe('journalActionLabel', () => {
	it('даёт иконку и подпись каждому действию', () => {
		expect(journalActionLabel('like')).toEqual({ icon: '♥', title: 'Лайк' });
		expect(journalActionLabel('later').title).toBe('Посмотреть позже');
		expect(journalActionLabel('done').title).toBe('Просмотрено');
	});
});

describe('readJournalParams', () => {
	const url = (qs: string) => new URL(`https://x.test/u/a/journal${qs}`);
	it('читает фильтр, тип и поиск', () => {
		expect(readJournalParams(url('?filter=likes&kind=book&q=%20дюна%20'), false)).toEqual({
			filter: 'likes',
			kind: 'book',
			q: 'дюна'
		});
	});
	it('приватный фильтр гостю превращается в «Все»', () => {
		expect(readJournalParams(url('?filter=notes'), false).filter).toBe('all');
		expect(readJournalParams(url('?filter=later'), false).filter).toBe('all');
		expect(readJournalParams(url('?filter=notes'), true).filter).toBe('notes');
	});
	it('мусор в адресе игнорируется', () => {
		expect(readJournalParams(url('?filter=x&kind=painting'), true)).toEqual({
			filter: 'all',
			kind: undefined,
			q: undefined
		});
	});
});
