import { describe, expect, it } from 'vitest';
import type { SchemaCollection, SchemaCollectionDetail } from '#lib/api/generated/social.ts';
import { rankSimilar } from './featured';

const ref = (id: string) => ({ id, slug: id, kind: 'film', title: id });
const coll = (id: string, preview: string[], theme: string | null = null) =>
	({ id, theme, preview: preview.map(ref) }) as unknown as SchemaCollection;
const current = {
	id: 'cur',
	theme: 'noir',
	items: ['a', 'b', 'c'].map((id) => ({ entity: ref(id) }))
} as unknown as SchemaCollectionDetail;

describe('rankSimilar', () => {
	it('общие произведения ×3, тема ×1, порядок API при равенстве, без себя', () => {
		const list = [
			coll('cur', ['a', 'b']),
			coll('none', ['x']),
			coll('theme', ['x'], 'noir'),
			coll('one', ['a']),
			coll('two', ['a', 'b']),
			coll('none2', ['y'])
		];
		expect(rankSimilar(current, list).map((c) => c.id)).toEqual([
			'two',
			'one',
			'theme',
			'none',
			'none2'
		]);
	});

	it('лимит и пустая тема не совпадает с пустой', () => {
		const list = [coll('p', []), coll('q', [], null), coll('r', ['c'])];
		expect(rankSimilar({ ...current, theme: null }, list, 2).map((c) => c.id)).toEqual(['r', 'p']);
	});
});
