import { describe, expect, it } from 'vitest';
import { dropLegacyStorage } from './legacy-storage';

describe('dropLegacyStorage', () => {
	it('убирает старые голоса, отметки и реакции, остальное не трогает', () => {
		const data = new Map([
			['nexus.review-votes.u1', '{}'],
			['nexus.marks.u1', '{}'],
			['nexus.reaction.dune-2021', 'fire'],
			['nexus.trailer.provider', 'rutube'],
			['nexus.refresh', 'token']
		]);
		dropLegacyStorage({
			get length() {
				return data.size;
			},
			key: (i) => [...data.keys()][i] ?? null,
			removeItem: (k) => void data.delete(k)
		});
		expect([...data.keys()]).toEqual(['nexus.trailer.provider', 'nexus.refresh']);
	});
});
