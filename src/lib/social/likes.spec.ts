import { describe, expect, it } from 'vitest';
import type { SchemaLikeTarget } from '#lib/api/generated/social.ts';
import { likePlace, LIKE_FILTERS } from './likes.ts';

describe('likePlace', () => {
	it('подборка — ссылка на неё', () => {
		expect(
			likePlace({
				kind: 'collection',
				collection_id: 'c1',
				title: 'Лучшее за год'
			} as SchemaLikeTarget)
		).toEqual({ href: '/collections/c1', title: 'Лучшее за год', note: 'Подборка' });
	});

	it('человек — его страница', () => {
		expect(
			likePlace({
				kind: 'person',
				person: { id: 'p1', slug: 'denis-villeneuve', full_name: 'Дени Вильнёв' }
			} as SchemaLikeTarget)
		).toEqual({ href: '/people/denis-villeneuve', title: 'Дени Вильнёв', note: 'Человек' });
	});

	// Бэкенд может завести лайки чему-то ещё раньше, чем фронтенд о них узнает.
	it('незнакомый вид — подпись без ссылки', () => {
		expect(likePlace({ kind: 'wat' } as unknown as SchemaLikeTarget).href).toBeNull();
	});
});

describe('LIKE_FILTERS', () => {
	// Лайков у произведений нет: target=entity всегда отдаёт пустую страницу, и предлагать
	// такой фильтр значило бы вести пользователя в заведомо пустой список.
	it('произведений среди фильтров нет', () => {
		expect(LIKE_FILTERS.map((f) => f.value)).toEqual([undefined, 'collection', 'person']);
	});
});
