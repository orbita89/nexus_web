import { describe, expect, it } from 'vitest';
import { describePart, formatBytes, groupOf, groupParts } from './sidecar.ts';

describe('sidecar', () => {
	it('группы частей', () => {
		expect(groupOf('meta')).toBe('Сущности');
		expect(groupOf('order:popular')).toBe('Порядки сортировки');
		expect(groupOf('facet:tag')).toBe('Фасеты (фильтры)');
		expect(groupOf('people:order:fame')).toBe('Люди');
		expect(groupOf('hints:studio')).toBe('Фасеты (фильтры)');
	});

	it('подписи', () => {
		expect(describePart('order:new')).toContain('Новинки');
		expect(describePart('facet:tag')).toContain('«tag»');
		expect(describePart('people:role:actor')).toContain('actor');
		expect(describePart('hints:studio')).toContain('«studio»');
	});

	it('роли людей сворачиваются, крупные сверху', () => {
		const groups = groupParts([
			{ name: 'people:role:actor', bytes: 10, items: 5, mapped: false },
			{ name: 'people:role:director', bytes: 5, items: 2, mapped: false },
			{ name: 'people:fame', bytes: 100, items: 25, mapped: false },
			{ name: 'meta', bytes: 8, items: 1, mapped: false },
			{ name: 'base_rank', bytes: 16, items: 2, mapped: false }
		]);
		const people = groups.find((g) => g.group === 'Люди')!;
		expect(people.bytes).toBe(115);
		expect(people.parts.map((p) => p.name)).toEqual(['people:fame', 'people:roles']);
		expect(groups.find((g) => g.group === 'Сущности')!.parts[0].name).toBe('base_rank');
	});

	it('размеры', () => {
		expect(formatBytes(512)).toBe('512 Б');
		expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 МБ');
	});
});
