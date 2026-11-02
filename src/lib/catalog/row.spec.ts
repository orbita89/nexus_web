import { beforeEach, describe, expect, it } from 'vitest';
import {
	extendRow,
	markSeen,
	neighbours,
	readRow,
	recentlySeen,
	rememberRow,
	type Row
} from './row';

// sessionStorage в node-окружении нет — подменяем простейшим хранилищем в памяти.
const data = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', {
	configurable: true,
	value: {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k)
	}
});

const row: Row = {
	label: 'Поль Гоген',
	slugs: ['a', 'b', 'c'],
	total: 5,
	more: { filters: { person: 'pol-gogen', role: 'artist' }, kind: 'painting' }
};

describe('ряд листания', () => {
	beforeEach(() => data.clear());

	it('запоминается и возвращается только для своих работ', () => {
		rememberRow(row);
		expect(readRow('b')).toEqual(row);
		expect(readRow('z')).toBeNull();
	});

	it('пустое и испорченное хранилище — без ряда', () => {
		expect(readRow('a')).toBeNull();
		data.set('nexus:row', '{не json');
		expect(readRow('a')).toBeNull();
		data.set('nexus:row', JSON.stringify({ label: 'x' }));
		expect(readRow('a')).toBeNull();
	});

	it('дочитанная порция встаёт в конец без повторов', () => {
		rememberRow(row);
		const next = extendRow(row, ['c', 'd', 'e']);
		expect(next.slugs).toEqual(['a', 'b', 'c', 'd', 'e']);
		// Новый ряд сразу в хранилище: следующая карточка увидит дочитанное.
		expect(readRow('e')).toEqual(next);
	});

	it('соседи и признак «есть что дочитать»', () => {
		expect(neighbours(row, 'a')).toMatchObject({ at: 0, prev: null, next: 'b', canExtend: true });
		expect(neighbours(row, 'b')).toMatchObject({ at: 1, prev: 'a', next: 'c' });
		// Последняя из показанных: следующей нет, но ряд ещё дочитывается (3 из 5).
		expect(neighbours(row, 'c')).toMatchObject({ at: 2, next: null, canExtend: true });
		const whole = { ...row, total: 3 };
		expect(neighbours(whole, 'c').canExtend).toBe(false);
		expect(neighbours(row, 'z')).toMatchObject({ at: -1, prev: null, next: null });
	});
});

describe('недавно показанные', () => {
	beforeEach(() => data.clear());

	it('свежие первыми, без повторов', () => {
		markSeen('a');
		markSeen('b');
		markSeen('a');
		expect(recentlySeen()).toEqual(['a', 'b']);
	});

	it('испорченное хранилище — пустой список', () => {
		data.set('nexus:seen', '{не json');
		expect(recentlySeen()).toEqual([]);
		data.set('nexus:seen', JSON.stringify(['a', 7, 'b']));
		expect(recentlySeen()).toEqual(['a', 'b']);
	});
});
