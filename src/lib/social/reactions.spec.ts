import { describe, expect, it } from 'vitest';
import { applyReaction } from './reactions';

const counts = { fire: 2, sad: 0, think: 1, bored: 0 };

describe('applyReaction', () => {
	it('ставит, переносит и снимает', () => {
		expect(applyReaction(counts, null, 'sad')).toEqual({
			counts: { fire: 2, sad: 1, think: 1, bored: 0 },
			mine: 'sad'
		});
		expect(applyReaction(counts, 'fire', 'think')).toEqual({
			counts: { fire: 1, sad: 0, think: 2, bored: 0 },
			mine: 'think'
		});
		expect(applyReaction(counts, 'fire', 'fire')).toEqual({
			counts: { fire: 1, sad: 0, think: 1, bored: 0 },
			mine: null
		});
	});
});
