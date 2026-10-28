import { describe, expect, it } from 'vitest';
import type { SchemaEntityCredit, SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
import {
	aboutRows,
	aboutTitle,
	creditGroups,
	isReleased,
	originalTitle,
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
	release_status: 'released',
	active: true,
	visible: true,
	created_at: '',
	updated_at: '',
	metadata: { runtime_min: 155, countries: ['US', 'CA'], age_rating: 'PG-13' },
	studios: [],
	tags: [
		{ id: 't1', slug: 'sci-fi', name: 'Научная фантастика', kind: 'genre' },
		{ id: 't2', slug: 'drama', name: 'Драма', kind: 'genre' }
	],
	related: [],
	awards: [],
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
	it('съёмочная группа по ролям, без актёров (они в титрах ниже); подписи — по Кинопоиску', () => {
		const rows = aboutRows({ ...dune, original_title: 'Dune' });
		expect(labels(rows)).toEqual([
			'Год производства',
			'Страна',
			'Режиссёр',
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

	it('в строке — первые трое, остальные — «и ещё N»', () => {
		const producers = ['А', 'Б', 'В', 'Г', 'Д'].map((name) => credit('producer', name));
		const row = aboutRows({ ...dune, credits: producers }).find((r) => r.label === 'Продюсер')!;
		expect(row.links?.map((l) => l.text)).toEqual(['А', 'Б', 'В']);
		expect(row.more).toBe(2);
	});
});

describe('creditGroups', () => {
	it('группы в порядке таблицы ролей, внутри — порядок титров', () => {
		const groups = creditGroups(dune.credits);
		expect(groups.map((g) => g.title)).toEqual([
			'Режиссёры',
			'Сценаристы',
			'Композиторы',
			'В ролях'
		]);
		expect(groups[3].credits.map((c) => c.person.full_name)).toEqual(['Шаламе', 'Фергюсон']);
	});

	it('человек в нескольких ролях — в каждой группе, но в группе один раз', () => {
		const groups = creditGroups([
			credit('director', 'Нолан'),
			credit('writer', 'Нолан'),
			credit('producer', 'Нолан'),
			credit('producer', 'Нолан')
		]);
		expect(groups.map((g) => [g.role, g.credits.length])).toEqual([
			['director', 1],
			['writer', 1],
			['producer', 1]
		]);
	});

	it('сразу видно: актёров — 12, остальных — 6; новые роли — после, подпись как есть', () => {
		const groups = creditGroups([
			credit('stunts', 'Каскадёр'),
			credit('actor', 'Актёр'),
			credit('cinematographer', 'ван Хойтема'),
			credit('editor', 'Ли Смит')
		]);
		expect(groups.map((g) => [g.title, g.shown])).toEqual([
			['Операторы', 6],
			['Монтажёры', 6],
			['В ролях', 12],
			['Stunts', 6]
		]);
		expect(creditGroups([])).toEqual([]);
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

	it('фильм: студии ссылками из studios (не из metadata), сначала победы, факты', () => {
		const p = productionOf({
			...dune,
			studios: [
				{ slug: 'legendary-pictures', name: 'Legendary Pictures', logo_url: 'https://x/l.png' },
				{ slug: 'mosfilm', name: 'Mosfilm' }
			],
			metadata: {
				studios: ['Legendary Pictures', 'Mosfilm', 'Ещё без страницы'],
				// awards в контракте описаны схемой премии — приходят строчки (см. card.ts).
				awards: [
					{ title: 'Оскар — фильм', year: 2022, won: false },
					{ title: 'Оскар — звук', year: 2022, won: true }
				],
				trivia: ['Иордания']
			} as unknown as SchemaEntityDetail['metadata']
		});
		expect(p?.studiosTitle).toBe('Студии');
		expect(p?.studios).toEqual([
			{
				name: 'Legendary Pictures',
				href: '/studios/legendary-pictures',
				logoUrl: 'https://x/l.png'
			},
			{ name: 'Mosfilm', href: '/studios/mosfilm', logoUrl: undefined }
		]);
		expect(p?.awards.map((a) => a.won)).toEqual([true, false]);
		expect(p?.triviaTitle).toBe('Факты о съёмках');
	});

	it('игра — разработчик и издатель, книга — издательство', () => {
		expect(
			productionOf({
				kind: 'game',
				metadata: { developer: 'CDPR', publisher: 'CDPR' },
				studios: []
			})?.studios
		).toEqual([{ name: 'CDPR' }]);
		expect(
			productionOf({ kind: 'book', metadata: { publisher: 'Chilton' }, studios: [] })?.studiosTitle
		).toBe('Издательство');
	});
});
