import { describe, expect, it } from 'vitest';
import {
	ageRating,
	count,
	countryName,
	keyFacts,
	leadCredits,
	creditLabel,
	filmography,
	formatDate,
	formatRuntime,
	metadataFields,
	plural,
	roleGroupTitle,
	roleLabel,
	summary,
	yearOf,
	titleWithYear
} from './labels';
import { entityHref, refHref } from './kinds';

describe('plural', () => {
	const forms = ['сезон', 'сезона', 'сезонов'] as const;
	it.each([
		[1, 'сезон'],
		[2, 'сезона'],
		[5, 'сезонов'],
		[11, 'сезонов'],
		[12, 'сезонов'],
		[21, 'сезон'],
		[22, 'сезона'],
		[111, 'сезонов']
	])('%i → %s', (n, word) => expect(plural(n, forms)).toBe(word));

	it('count', () => expect(count(1500, ['оценка', 'оценки', 'оценок'])).toBe('1\u00a0500 оценок'));
});

describe('метки', () => {
	it('роли', () => {
		expect(roleLabel('actor')).toBe('Актёр');
		expect(roleLabel('voice_actor')).toBe('Озвучивание');
		expect(roleLabel('editor')).toBe('Монтажёр');
		expect(roleGroupTitle('cinematographer')).toBe('Операторы');
		expect(roleGroupTitle('actor')).toBe('В ролях');
		expect(roleGroupTitle('art_director')).toBe('Art director');
		expect(roleLabel('art_director')).toBe('Art director');
	});

	it('длительность', () => {
		expect(formatRuntime(155)).toBe('2 ч 35 мин');
		expect(formatRuntime(120)).toBe('2 ч');
		expect(formatRuntime(45)).toBe('45 мин');
	});

	it('страны', () => {
		expect(countryName('US')).toBe('США');
		expect(countryName('su')).toBe('СССР');
		expect(countryName('PL')).toBe('Польша');
	});

	it('год и дата', () => {
		expect(yearOf('2021-10-22')).toBe('2021');
		expect(yearOf(null)).toBeNull();
		expect(titleWithYear({ title: 'Дюна', release_date: '2021-09-03' })).toBe('Дюна (2021)');
		expect(titleWithYear({ title: 'Дюна', release_date: null })).toBe('Дюна');
		expect(formatDate('1965-08-01')).toMatch(/^1 августа 1965/);
	});

	it('адрес карточки по типу', () => {
		expect(entityHref({ kind: 'movie', slug: 'dune-2021' })).toBe('/films/dune-2021');
		expect(entityHref({ kind: 'book', slug: 'dune-novel' })).toBe('/books/dune-novel');
		expect(refHref({ kind: 'game', slug: 'elden-ring' })).toBe('/games/elden-ring');
		expect(refHref({ kind: 'comic', slug: 'x' })).toBeNull();
	});
});

describe('metadataFields', () => {
	it('фильм', () => {
		expect(
			metadataFields('movie', { runtime_min: 155, countries: ['US', 'CA'], age_rating: 'PG-13' })
		).toEqual([
			{ label: 'Длительность', value: '2 ч 35 мин' },
			{ label: 'Страны', value: 'США, Канада' },
			{ label: 'Возрастной рейтинг', value: 'PG-13' }
		]);
	});

	it('сериал', () => {
		expect(metadataFields('series', { seasons: 4, episodes: 32, status: 'ongoing' })).toEqual([
			{ label: 'Сезоны', value: '4' },
			{ label: 'Эпизоды', value: '32' },
			{ label: 'Статус', value: 'Идёт' }
		]);
	});

	it('книга', () => {
		expect(metadataFields('book', { pages: 1896, publisher: 'Ace Books', isbn: null })).toEqual([
			{ label: 'Страниц', value: '1\u00a0896' },
			{ label: 'Издатель', value: 'Ace Books' }
		]);
	});

	it('игра', () => {
		expect(
			metadataFields('game', { platforms: ['pc', 'ps5', 'xbox-series', 'dreamcast'] })
		).toEqual([{ label: 'Платформы', value: 'PC, PlayStation 5, Xbox Series X|S, dreamcast' }]);
	});

	it('пустая metadata — нет полей', () => {
		expect(metadataFields('movie', {})).toEqual([]);
		expect(metadataFields('game', { platforms: [] })).toEqual([]);
	});
});

describe('summary', () => {
	it('короткий текст — как есть, одной строкой', () => {
		expect(summary('Пол  Атрейдес\nи Арракис')).toBe('Пол Атрейдес и Арракис');
		expect(summary(null)).toBe('');
	});

	it('длинный — обрезка по слову', () => {
		const s = summary('слово '.repeat(50), 40);
		expect(s.length).toBeLessThanOrEqual(40);
		expect(s).toMatch(/слово…$/);
	});
});

describe('работы человека', () => {
	it('роль с персонажем', () => {
		expect(creditLabel({ role: 'actor', character_name: 'Пол Атрейдес' })).toBe(
			'Актёр — Пол Атрейдес'
		);
		expect(creditLabel({ role: 'director', character_name: null })).toBe('Режиссёр');
	});

	it('фильмография по ролям: главная роль первой, внутри — новые сверху, без даты — в конце', () => {
		const film = (id: string, release_date: string | null) => ({ id, release_date });
		const [a, b, c] = [film('a', '2010-07-16'), film('b', '2014-11-06'), film('c', null)];
		const roles = filmography([
			{ entity: a, role: 'writer' },
			{ entity: c, role: 'director' },
			{ entity: a, role: 'director' },
			{ entity: b, role: 'director' },
			{ entity: b, role: 'actor', character_name: 'Купер' },
			{ entity: b, role: 'actor', character_name: 'Камео' }
		]);
		expect(roles.map((r) => [r.title, r.works.map((w) => w.entity.id)])).toEqual([
			['Режиссёр', ['b', 'a', 'c']],
			['Сценарист', ['a']],
			['Актёр', ['b']]
		]);
		expect(roles[2].works[0].caption).toBe('Купер, Камео');
	});
});

describe('шапка карточки', () => {
	it('строка фактов по типу', () => {
		expect(keyFacts('movie', { runtime_min: 155, countries: ['US'] }, '2021-10-22')).toEqual([
			'2021',
			'2 ч 35 мин'
		]);
		expect(keyFacts('series', { seasons: 1 }, '2019-12-20')).toEqual(['2019', '1 сезон']);
		expect(keyFacts('book', { pages: 896 }, null)).toEqual(['896 страниц']);
		expect(keyFacts('game', { developer: 'CD Projekt Red' }, '2015-05-19')).toEqual([
			'2015',
			'CD Projekt Red'
		]);
		expect(keyFacts('movie', {}, null)).toEqual([]);
	});

	it('возрастной рейтинг — только у фильма', () => {
		expect(ageRating('movie', { age_rating: 'PG-13' })).toBe('PG-13');
		expect(ageRating('movie', {})).toBeNull();
		expect(ageRating('series', {})).toBeNull();
	});

	it('главные люди: роль по типу, порядок титров', () => {
		const credits = [
			{ role: 'actor', person: 'Шаламе' },
			{ role: 'director', person: 'Вильнёв' },
			{ role: 'writer', person: 'Спейтс' }
		];
		expect(leadCredits('movie', credits)).toEqual({ label: 'Режиссёр', people: ['Вильнёв'] });
		expect(leadCredits('book', [{ role: 'author', person: 'Герберт' }])).toEqual({
			label: 'Автор',
			people: ['Герберт']
		});
		expect(leadCredits('series', [{ role: 'creator', person: 'Хиссрич' }])).toEqual({
			label: 'Создатель',
			people: ['Хиссрич']
		});
		expect(leadCredits('movie', [{ role: 'actor', person: 'X' }])).toBeNull();
	});
});
