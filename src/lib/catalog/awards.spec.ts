import { describe, expect, it } from 'vitest';
import type { SchemaEntityAward, SchemaNomination } from '#lib/api/generated/catalog.ts';
import {
	editionMeta,
	groupAwards,
	nomineeHref,
	nomineeName,
	nomineeNote,
	readAwardKind,
	seasonLabel,
	yearsLabel
} from './awards.ts';

const entity = {
	id: 'e1',
	slug: 'oppenheimer-2023',
	kind: 'movie' as const,
	title: 'Оппенгеймер',
	release_date: '2023-07-19',
	release_status: 'released' as const,
	active: true,
	visible: true,
	created_at: '',
	updated_at: ''
};
const person = { id: 'p1', slug: 'nolan', full_name: 'Кристофер Нолан' };

const award = (
	slug: string,
	year: number,
	won: boolean,
	category = 'Лучший фильм'
): SchemaEntityAward => ({
	award: { slug, title: slug === 'oscar' ? 'Оскар' : 'BAFTA' },
	category: { slug: 'best-picture', title: category },
	year,
	won
});

describe('yearsLabel', () => {
	it('диапазон, один год и пусто', () => {
		expect(yearsLabel({ first_year: 1929, latest_year: 2024 })).toBe('1929–2024');
		expect(yearsLabel({ first_year: 2024, latest_year: 2024 })).toBe('2024');
		expect(yearsLabel({ first_year: null, latest_year: null })).toBeNull();
	});
});

describe('seasonLabel', () => {
	it('только когда год работ отличается от года церемонии', () => {
		expect(seasonLabel({ year: 2024, season_year: 2023 })).toBe('за 2023 год');
		expect(seasonLabel({ year: 2024, season_year: 2024 })).toBeNull();
		expect(seasonLabel({ year: 2024, season_year: null })).toBeNull();
	});
});

describe('editionMeta', () => {
	it('собирает только известное', () => {
		expect(
			editionMeta({ year: 2024, season_year: 2023, number: 96, held_on: null, place: 'Dolby' })
		).toEqual(['96-я церемония', 'Dolby', 'за 2023 год']);
		expect(
			editionMeta({ year: 2024, season_year: null, number: null, held_on: null, place: null })
		).toEqual([]);
	});
});

describe('номинант', () => {
	const nomination = (over: Partial<SchemaNomination>): SchemaNomination => ({
		id: 'n1',
		won: false,
		...over
	});

	it('человек важнее работы: имя, ссылка на профиль, работа — подписью', () => {
		const n = nomination({ person, entity, role: 'режиссёр' });
		expect(nomineeName(n)).toBe('Кристофер Нолан');
		expect(nomineeHref(n)).toBe('/people/nolan');
		expect(nomineeNote(n)).toBe('Оппенгеймер · режиссёр');
	});

	it('работа без человека — ссылка на карточку, подписи нет', () => {
		const n = nomination({ entity });
		expect(nomineeName(n)).toBe('Оппенгеймер');
		expect(nomineeHref(n)).toBe('/films/oppenheimer-2023');
		expect(nomineeNote(n)).toBeNull();
	});

	it('нет ни того ни другого — строка из name и без ссылки', () => {
		const n = nomination({ name: 'Pixar' });
		expect(nomineeName(n)).toBe('Pixar');
		expect(nomineeHref(n)).toBeNull();
	});
});

describe('groupAwards', () => {
	it('по премиям и годам: премии с победами выше, годы — новые сверху', () => {
		const groups = groupAwards([
			award('bafta', 2015, false),
			award('oscar', 2015, false),
			award('oscar', 2024, true),
			award('oscar', 2024, false, 'Лучший звук')
		]);
		expect(groups.map((g) => g.award.slug)).toEqual(['oscar', 'bafta']);
		expect(groups[0].years.map((y) => y.year)).toEqual([2024, 2015]);
		// Внутри года победа выше номинации.
		expect(groups[0].years[0].items.map((i) => i.won)).toEqual([true, false]);
		expect(groups[1].won).toBe(false);
	});

	it('пусто — пусто', () => {
		expect(groupAwards([])).toEqual([]);
	});
});

describe('readAwardKind', () => {
	it('только известный тип работ', () => {
		expect(readAwardKind('movie')).toBe('movie');
		expect(readAwardKind('films')).toBeUndefined();
		expect(readAwardKind(undefined)).toBeUndefined();
	});
});
