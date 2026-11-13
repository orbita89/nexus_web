import { describe, expect, it } from 'vitest';
import { EMPTY_SOURCES, groupJournal, pageJournal } from './journal.fallback.ts';

const dune = { id: 'e1', kind: 'movie', slug: 'dune', title: 'Дюна' };
const matrix = { id: 'e2', kind: 'movie', slug: 'matrix', title: 'Матрица' };

describe('groupJournal', () => {
	it('собирает действия над одним произведением в одну запись', () => {
		const items = groupJournal(
			{
				...EMPTY_SOURCES,
				likes: [{ entity: dune, created_at: '2026-01-01T00:00:00Z' }],
				ratings: [{ entity: dune, rating: 9, created_at: '2026-01-02T00:00:00Z' }]
			},
			false
		);
		expect(items).toHaveLength(1);
		expect(items[0].actions).toEqual(['like', 'rating']);
		expect(items[0].rating).toBe(9);
	});

	it('сортирует по самой свежей дате действия', () => {
		const items = groupJournal(
			{
				...EMPTY_SOURCES,
				likes: [
					{ entity: dune, created_at: '2026-01-01T00:00:00Z' },
					{ entity: matrix, created_at: '2026-01-05T00:00:00Z' }
				],
				ratings: [{ entity: dune, rating: 7, created_at: '2026-01-10T00:00:00Z' }]
			},
			false
		);
		expect(items.map((i) => i.entity.id)).toEqual(['e1', 'e2']);
		expect(items[0].last_activity_at).toBe('2026-01-10T00:00:00Z');
	});

	it('рецензия получает отрывок', () => {
		const items = groupJournal(
			{
				...EMPTY_SOURCES,
				reviews: [
					{
						id: 'r1',
						entity: dune,
						body: 'а'.repeat(300),
						is_spoiler: true,
						rating: 8,
						created_at: '2026-01-01T00:00:00Z'
					}
				]
			},
			false
		);
		expect(items[0].actions).toEqual(['rating', 'review']);
		expect(items[0].review?.is_spoiler).toBe(true);
		expect(items[0].review?.excerpt.length).toBeLessThan(300);
	});

	const privateSources = {
		...EMPTY_SOURCES,
		likes: [{ entity: dune, created_at: '2026-01-01T00:00:00Z' }],
		notes: [{ entity: dune, body: 'пересмотреть', updated_at: '2026-01-02T00:00:00Z' }],
		marks: [{ entity: matrix, kind: 'later' as const, created_at: '2026-01-03T00:00:00Z' }]
	};

	it('скрывает заметки и отметки от не-владельца', () => {
		const items = groupJournal(privateSources, false);
		expect(items).toHaveLength(1);
		expect(items[0].note).toBeUndefined();
		expect(items[0].actions).toEqual(['like']);
	});

	it('показывает заметки и отметки владельцу', () => {
		const items = groupJournal(privateSources, true);
		expect(items.map((i) => i.entity.id)).toEqual(['e2', 'e1']);
		expect(items[0].mark).toBe('later');
		expect(items[1].note?.body).toBe('пересмотреть');
	});
});

describe('pageJournal', () => {
	const items = groupJournal(
		{
			...EMPTY_SOURCES,
			likes: [
				{ entity: dune, created_at: '2026-01-02T00:00:00Z' },
				{ entity: matrix, created_at: '2026-01-01T00:00:00Z' }
			]
		},
		false
	);
	it('режет на страницы курсором', () => {
		const first = pageJournal(items, { filter: 'all' }, 1);
		expect(first.items).toHaveLength(1);
		expect(first.next_cursor).toBe('1');
		const second = pageJournal(items, { filter: 'all', cursor: first.next_cursor }, 1);
		expect(second.items[0].entity.id).toBe('e2');
		expect(second.next_cursor).toBeNull();
	});
	it('ищет по названию', () => {
		expect(pageJournal(items, { filter: 'all', q: 'матр' }, 20).items).toHaveLength(1);
	});
});
