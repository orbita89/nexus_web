import { describe, expect, it } from 'vitest';
import type { SchemaReputation, SchemaUserCommentTarget } from '#lib/api/generated/social.ts';
import {
	byKindRows,
	canSeeStats,
	commentPlace,
	readMarkKind,
	readRatingsSort,
	reputationParts
} from './profile.ts';

const url = (query: string) => new URL(`https://nexus.local/u/user${query}`);
const profile = (stats_public: boolean) => ({ user: { username: 'user' }, stats_public });
const viewer = (username: string, role: 'user' | 'admin' = 'user') =>
	({ username, role }) as Parameters<typeof canSeeStats>[1];

describe('canSeeStats', () => {
	it('открытую статистику видят все, включая гостя', () => {
		expect(canSeeStats(profile(true), null)).toBe(true);
		expect(canSeeStats(profile(true), viewer('other'))).toBe(true);
	});

	it('закрытую — только владелец и админ', () => {
		expect(canSeeStats(profile(false), null)).toBe(false);
		expect(canSeeStats(profile(false), viewer('other'))).toBe(false);
		expect(canSeeStats(profile(false), viewer('user'))).toBe(true);
		expect(canSeeStats(profile(false), viewer('other', 'admin'))).toBe(true);
	});
});

describe('readRatingsSort', () => {
	it('нет параметра или мусор — «новые»', () => {
		expect(readRatingsSort(url(''))).toBe('new');
		expect(readRatingsSort(url('?sort=wat'))).toBe('new');
	});

	it('известный порядок проходит как есть', () => {
		expect(readRatingsSort(url('?sort=rating_desc'))).toBe('rating_desc');
		expect(readRatingsSort(url('?sort=rating_asc'))).toBe('rating_asc');
	});
});

describe('readMarkKind', () => {
	it('нет параметра или мусор — обе отметки (undefined)', () => {
		expect(readMarkKind(url(''))).toBeUndefined();
		expect(readMarkKind(url('?kind=all'))).toBeUndefined();
	});

	it('later и done проходят', () => {
		expect(readMarkKind(url('?kind=later'))).toBe('later');
		expect(readMarkKind(url('?kind=done'))).toBe('done');
	});
});

describe('reputationParts', () => {
	const reputation = (parts: Record<string, unknown>): SchemaReputation =>
		({ score: 42, parts }) as SchemaReputation;

	it('известные слагаемые идут в своём порядке и с подписями', () => {
		const parts = reputationParts(
			reputation({ collection_reactions: 1, review_likes: 3, profile_likes: 2 })
		);
		expect(parts.map((p) => [p.key, p.title, p.value])).toEqual([
			['profile_likes', 'Лайки профиля', 2],
			['review_likes', 'Лайки ваших рецензий', 3],
			['collection_reactions', 'Реакции на ваши коллекции', 1]
		]);
	});

	it('нули прячем, незнакомые ключи показываем как есть', () => {
		const parts = reputationParts(reputation({ profile_likes: 0, something_new: 5 }));
		expect(parts).toEqual([{ key: 'something_new', title: 'something_new', value: 5 }]);
	});

	it('слагаемых ещё нет — пусто (балл стартовый)', () => {
		expect(reputationParts(reputation({}))).toEqual([]);
	});
});

describe('commentPlace', () => {
	const entity = {
		id: 'e1',
		kind: 'movie',
		slug: 'dune-2021',
		title: 'Дюна'
	};

	it('произведение — ссылка на карточку', () => {
		expect(commentPlace({ kind: 'entity', entity } as SchemaUserCommentTarget)).toEqual({
			href: '/films/dune-2021',
			title: 'Дюна',
			note: 'Произведение'
		});
	});

	it('рецензия — ссылка на рецензии произведения', () => {
		const place = commentPlace({
			kind: 'review',
			review_id: 'r1',
			entity
		} as SchemaUserCommentTarget);
		expect(place).toEqual({ href: '/films/dune-2021/reviews', title: 'Дюна', note: 'Рецензия' });
	});

	it('человек и студия — свои страницы', () => {
		expect(
			commentPlace({
				kind: 'person',
				person: { id: 'p1', slug: 'denis-villeneuve', full_name: 'Дени Вильнёв' }
			} as SchemaUserCommentTarget).href
		).toBe('/people/denis-villeneuve');
		expect(
			commentPlace({
				kind: 'studio',
				studio: { id: 's1', slug: 'legendary', name: 'Legendary' }
			} as SchemaUserCommentTarget).href
		).toBe('/studios/legendary');
	});

	it('подборка — её обсуждение', () => {
		expect(
			commentPlace({
				kind: 'collection',
				collection_id: 'c1',
				title: 'Подборка'
			} as SchemaUserCommentTarget)
		).toEqual({ href: '/collections/c1/discussion', title: 'Подборка', note: 'Подборка' });
	});

	// Бэкенд может завести новый вид цели раньше, чем фронтенд о нём узнает.
	it('незнакомый вид — подпись без ссылки', () => {
		expect(commentPlace({ kind: 'wat' } as unknown as SchemaUserCommentTarget).href).toBeNull();
	});
});

describe('byKindRows', () => {
	it('типы каталога получают подписи, пустые разделы уходят', () => {
		expect(byKindRows({ movie: 30, series: 0, book: 12 })).toEqual([
			{ title: 'Фильмы', value: 30 },
			{ title: 'Книги', value: 12 }
		]);
	});

	it('незнакомый тип показывается как есть', () => {
		expect(byKindRows({ comic: 3 })).toEqual([{ title: 'comic', value: 3 }]);
	});
});
