import { describe, expect, it } from 'vitest';
import type { SchemaKindRanking } from '#lib/api/generated/catalog.ts';
import { partShare, searchMix, toBody } from './ranking.ts';

const settings: SchemaKindRanking = {
	kind: 'movie',
	weight_quality: 0.5,
	weight_popularity: 0.3,
	weight_recency: 0.2,
	weight_site: 0.1,
	weight_complete: 0,
	search_popularity: 0.6,
	trust_votes: 5000,
	half_life_years: 4,
	min_votes: 1000,
	updated_at: '2026-11-25T12:00:00Z'
};

describe('ranking', () => {
	it('тело запроса без kind и updated_at', () => {
		const body = toBody(settings);
		expect(body.kind).toBeUndefined();
		expect(body.updated_at).toBeUndefined();
		expect(body.weight_quality).toBe(0.5);
	});

	it('подпись доли популярности в поиске', () => {
		expect(searchMix(0.6)).toBe('60% популярность · 40% совпадение текста');
		expect(searchMix(2)).toBe('100% популярность · 0% совпадение текста');
		expect(searchMix(-1)).toBe('0% популярность · 100% совпадение текста');
	});

	it('доля составляющей в балле', () => {
		expect(partShare(0.25, 1)).toBe(25);
		expect(partShare(1, 0)).toBe(0);
	});
});
