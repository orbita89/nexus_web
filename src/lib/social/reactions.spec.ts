import { describe, expect, it } from 'vitest';
import { applyReaction, isMine, type ReactionItem } from './reactions';

const items: ReactionItem[] = [
	{ emoji: '🔥', count: 2, mine: false },
	{ emoji: '😢', count: 1, mine: true }
];

describe('applyReaction', () => {
	it('ставит новую реакцию в конец строки', () => {
		expect(applyReaction(items, '❤️', true)).toEqual([
			{ emoji: '🔥', count: 2, mine: false },
			{ emoji: '😢', count: 1, mine: true },
			{ emoji: '❤️', count: 1, mine: true }
		]);
	});

	it('добавляет свою к чужой, не трогая порядок', () => {
		expect(applyReaction(items, '🔥', true)).toEqual([
			{ emoji: '🔥', count: 3, mine: true },
			{ emoji: '😢', count: 1, mine: true }
		]);
	});

	it('снимает свою, а последнюю убирает из строки', () => {
		expect(applyReaction(items, '😢', false)).toEqual([{ emoji: '🔥', count: 2, mine: false }]);
	});

	it('снятие несуществующей ничего не ломает', () => {
		expect(applyReaction(items, '👍', false)).toEqual(items);
	});
});

describe('isMine', () => {
	it('различает свою и чужую', () => {
		expect(isMine(items, '😢')).toBe(true);
		expect(isMine(items, '🔥')).toBe(false);
		expect(isMine(items, '👍')).toBe(false);
	});
});
