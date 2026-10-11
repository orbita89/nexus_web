import { describe, expect, it } from 'vitest';
import type { SchemaEntityCredit, SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
import {
	aboutRows,
	aboutTitle,
	isReleased,
	originalTitle,
	peopleCard,
	productionOf,
	relatedWorks
} from './card';

let n = 0;
const credit = (role: string, name: string, character?: string): SchemaEntityCredit => ({
	id: `c${++n}`,
	role,
	position: n,
	character_name: character ?? null,
	person: { id: `p-${name}`, slug: name.toLowerCase(), full_name: name }
});

const dune: SchemaEntityDetail = {
	id: 'e1',
	slug: 'dune-2021',
	kind: 'movie',
	title: 'Дюна',
	release_date: '2021-09-03',
	created_at: '',
	updated_at: '',
	metadata: { runtime_min: 155, countries: ['US', 'CA'], age_rating: 'PG-13' },
	tags: [
		{ id: 't1', slug: 'sci-fi', name: 'Научная фантастика', kind: 'genre' },
		{ id: 't2', slug: 'drama', name: 'Драма', kind: 'genre' }
	],
	related: [],
	credits: [
		credit('director', 'Вильнёв'),
		credit('actor', 'Шаламе', 'Пол Атрейдес'),
		credit('writer', 'Спэйтс'),
		credit('writer', 'Вильнёв'),
		credit('actor', 'Фергюсон', 'Джессика'),
		credit('composer', 'Циммер')
	]
};

const labels = (rows: { label: string }[]) => rows.map((r) => r.label);

describe('aboutRows', () => {
	it('без режиссёра и актёров (они в плашке); группа — по Кинопоиску', () => {
		const rows = aboutRows({ ...dune, original_title: 'Dune' });
		expect(labels(rows)).toEqual([
			'Год производства',
			'Страна',
			'Сценарий',
			'Композитор',
			'Премьера',
			'Длительность',
			'Возрастной рейтинг'
		]);
		// Вильнёв и режиссёр, и сценарист: из «Сценария» он не пропадает.
		expect(rows.find((r) => r.label === 'Сценарий')?.links?.map((l) => l.text)).toEqual([
			'Спэйтс',
			'Вильнёв'
		]);
	});
});

describe('peopleCard', () => {
	it('режиссёр и актёры в порядке титров', () => {
		const card = peopleCard(dune)!;
		expect(card.lead?.label).toBe('Режиссёр');
		expect(card.lead?.credits.map((c) => c.person.full_name)).toEqual(['Вильнёв']);
		expect(card.cast.map((c) => c.person.full_name)).toEqual(['Шаламе', 'Фергюсон']);
	});

	it('у книги главный — автор; никого нет — null', () => {
		const book = { ...dune, kind: 'book' as const, credits: [credit('author', 'Херберт')] };
		expect(peopleCard(book)?.lead?.label).toBe('Автор');
		expect(peopleCard({ ...dune, credits: [] })).toBeNull();
	});
});

describe('originalTitle', () => {
	it('только если отличается от русского', () => {
		expect(originalTitle({ title: 'Дюна', original_title: 'Dune' })).toBe('Dune');
		expect(originalTitle({ title: 'Дюна', original_title: 'Дюна' })).toBeNull();
		expect(originalTitle({ title: 'Дюна' })).toBeNull();
	});
});

describe('relatedWorks', () => {
	const work = (
		slug: string,
		relation: 'prequel' | 'sequel' | 'remake',
		release_date: string | null
	) => ({ id: slug, slug, kind: 'movie' as const, title: slug, relation, release_date });

	it('связей нет — ничего', () => {
		expect(relatedWorks(dune)).toEqual([]);
	});

	it('одна лента в порядке бэкенда, у каждой — подпись; старший ремейк — «Оригинал»', () => {
		const works = relatedWorks({
			release_date: '2021-10-22',
			related: [
				work('dune-1984', 'remake', '1984-12-14'),
				work('prequel', 'prequel', '2019-01-01'),
				work('dune-2', 'sequel', '2024-03-01'),
				work('dune-2030', 'remake', '2030-01-01'),
				work('undated', 'sequel', null)
			]
		});
		expect(works.map((w) => [w.item.slug, w.label])).toEqual([
			['dune-1984', 'Оригинал'],
			['prequel', 'Приквел'],
			['dune-2', 'Сиквел'],
			['dune-2030', 'Ремейк'],
			['undated', 'Сиквел']
		]);
	});
});

describe('aboutTitle', () => {
	it.each([
		['movie', 'О фильме'],
		['series', 'О сериале'],
		['game', 'Об игре'],
		['book', 'О книге']
	] as const)('%s → %s', (kind, title) => expect(aboutTitle(kind)).toBe(title));
});

describe('isReleased', () => {
	it('дата в будущем — ещё нет; сегодня и раньше — вышло; без даты — вышло', () => {
		expect(isReleased('2026-12-01', '2026-10-09')).toBe(false);
		expect(isReleased('2026-10-09', '2026-10-09')).toBe(true);
		expect(isReleased('2021-09-03', '2026-10-09')).toBe(true);
		expect(isReleased(null, '2026-10-09')).toBe(true);
	});
});

describe('productionOf', () => {
	it('нет студий, наград и фактов — null (блока нет)', () => {
		expect(productionOf(dune)).toBeNull();
	});

	it('фильм: студии, сначала победы, факты', () => {
		const p = productionOf({
			...dune,
			metadata: {
				studios: ['Legendary'],
				awards: [
					{ title: 'Оскар — фильм', year: 2022, won: false },
					{ title: 'Оскар — звук', year: 2022, won: true }
				],
				trivia: ['Иордания']
			}
		});
		expect(p?.studiosTitle).toBe('Студии');
		expect(p?.awards.map((a) => a.won)).toEqual([true, false]);
		expect(p?.triviaTitle).toBe('Факты о съёмках');
	});

	it('игра — разработчик и издатель, книга — издательство', () => {
		expect(
			productionOf({ kind: 'game', metadata: { developer: 'CDPR', publisher: 'CDPR' } })?.studios
		).toEqual(['CDPR']);
		expect(productionOf({ kind: 'book', metadata: { publisher: 'Chilton' } })?.studiosTitle).toBe(
			'Издательство'
		);
	});
});
