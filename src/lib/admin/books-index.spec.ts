import { describe, expect, it } from 'vitest';
import {
	canMerge,
	formatBytes,
	formatDuration,
	isBehind,
	isRunning,
	operationTitle,
	share
} from './books-index.ts';

const text = (t: { docs?: number; segments?: number; deleted_docs?: number }) =>
	({ docs: 0, segments: 1, deleted_docs: 0, ...t }) as never;

describe('books-index', () => {
	it('formatBytes', () => {
		expect(formatBytes(0)).toBe('0 Б');
		expect(formatBytes(1536)).toBe('1,5 КБ');
		expect(formatBytes(50 * 1024 * 1024)).toBe('50 МБ');
	});

	it('formatDuration', () => {
		expect(formatDuration(420)).toBe('420 мс');
		expect(formatDuration(42_000)).toBe('42 с');
		expect(formatDuration(84_000)).toBe('1 мин 24 с');
		expect(formatDuration(120_000)).toBe('2 мин');
	});

	it('share', () => {
		expect(share(1, 4)).toBe(25);
		expect(share(1, 0)).toBe(0);
	});

	it('isBehind', () => {
		const sidecar = { books: 10 } as never;
		expect(isBehind({ db_books: 10, text: text({ docs: 10 }), sidecar })).toBe(false);
		expect(isBehind({ db_books: 11, text: text({ docs: 10 }), sidecar })).toBe(true);
		expect(
			isBehind({ db_books: 10, text: text({ docs: 10 }), sidecar: { books: 9 } as never })
		).toBe(true);
	});

	it('isRunning', () => {
		expect(isRunning(null)).toBe(false);
		expect(isRunning({ operation: null })).toBe(false);
		expect(isRunning({ operation: { op: 'merge', started_at: 'x', finished_at: null } })).toBe(
			true
		);
		expect(isRunning({ operation: { op: 'merge', started_at: 'x', finished_at: 'y' } })).toBe(
			false
		);
	});

	it('canMerge', () => {
		expect(canMerge({ text: text({}) })).toBe(false);
		expect(canMerge({ text: text({ segments: 2 }) })).toBe(true);
		expect(canMerge({ text: text({ deleted_docs: 3 }) })).toBe(true);
	});

	it('operationTitle', () => {
		expect(operationTitle('rebuild')).toBe('перестройка');
		expect(operationTitle('other')).toBe('other');
	});
});
