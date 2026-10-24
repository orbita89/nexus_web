import { describe, expect, it } from 'vitest';
import type { SchemaTargetComment } from '#lib/api/generated/social.ts';
import { commentTarget, threadComments } from './comments.ts';

function comment(id: string, parent: string | null = null): SchemaTargetComment {
	return {
		id,
		target: 'entity:dune-2021',
		author: { id: `author-${id}`, username: `user${id}` },
		body: id,
		parent_id: parent,
		created_at: '2026-10-01T00:00:00Z',
		updated_at: '2026-10-01T00:00:00Z'
	};
}

const ids = (threads: ReturnType<typeof threadComments>) =>
	threads.map((t) => [t.root.id, t.replies.map((r) => r.id)]);

describe('commentTarget', () => {
	it('складывает цель из вида и slug', () => {
		expect(commentTarget('entity', 'dune-2021')).toBe('entity:dune-2021');
		expect(commentTarget('person', 'denis-villeneuve')).toBe('person:denis-villeneuve');
		expect(commentTarget('studio', 'legendary-pictures')).toBe('studio:legendary-pictures');
	});
});

describe('threadComments', () => {
	it('группирует ответы под корнями, сохраняя порядок (старые сверху)', () => {
		const threads = threadComments([
			comment('a'),
			comment('a1', 'a'),
			comment('b'),
			comment('a2', 'a'),
			comment('b1', 'b')
		]);
		expect(ids(threads)).toEqual([
			['a', ['a1', 'a2']],
			['b', ['b1']]
		]);
	});

	it('пустой список — пустая лента', () => {
		expect(threadComments([])).toEqual([]);
	});

	// Ветка ровно одного уровня: бэкенд привязывает ответ на ответ к корню, поэтому рекурсии нет.
	it('ответ, корень которого не попал на страницу, показывается корневым', () => {
		expect(ids(threadComments([comment('orphan', 'missing')]))).toEqual([['orphan', []]]);
	});

	it('корень без ответов остаётся сам по себе', () => {
		expect(ids(threadComments([comment('a'), comment('b')]))).toEqual([
			['a', []],
			['b', []]
		]);
	});
});
