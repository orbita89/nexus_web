import { describe, expect, it } from 'vitest';
import { describeFile, formatMicros, pct } from './searchMap.ts';

describe('searchMap', () => {
	it('подписи файлов', () => {
		expect(describeFile('sidecar-entities.cols')).toContain('порядков');
		expect(describeFile('abc123.store')).toContain('карточки');
		expect(describeFile('abc123.idx')).toContain('postings');
		expect(describeFile('unknown.xyz')).toBe('Файл сегмента Tantivy');
	});

	it('время и доли', () => {
		expect(formatMicros(250)).toBe('250 мкс');
		expect(formatMicros(1500)).toBe('1.5 мс');
		expect(pct(0.42)).toBe(42);
		expect(pct(2)).toBe(100);
		expect(pct(-1)).toBe(0);
	});
});
