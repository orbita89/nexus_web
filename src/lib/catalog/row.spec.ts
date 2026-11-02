import { beforeEach, describe, expect, it } from 'vitest';
import { forgetRow, markSeen, readRow, recentlySeen, rememberRow, type Row } from './row';

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

const row: Row = { filters: { person: 'pol-gogen', role: 'artist' }, kind: 'painting' };

describe('ряд листания', () => {
	beforeEach(() => data.clear());

	it('запоминается, читается и забывается', () => {
		expect(readRow()).toBeNull();
		rememberRow(row);
		expect(readRow()).toEqual(row);
		forgetRow();
		expect(readRow()).toBeNull();
	});

	it('испорченное хранилище — без ряда', () => {
		data.set('nexus:row', '{не json');
		expect(readRow()).toBeNull();
		data.set('nexus:row', JSON.stringify({ kind: 'painting' }));
		expect(readRow()).toBeNull();
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
