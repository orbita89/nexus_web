import { describe, expect, it, vi } from 'vitest';
import { ratingsFor } from './load';

type Client = Parameters<typeof ratingsFor>[0];
const client = (GET: ReturnType<typeof vi.fn>) => ({ social: { GET } }) as unknown as Client;

describe('ratingsFor', () => {
	it('один запрос: slug’и без повторов, через запятую', async () => {
		const data = { 'dune-2021': { average: 8.3, count: 12 } };
		const GET = vi.fn().mockResolvedValue({ data, response: new Response(null) });
		const ratings = await ratingsFor(client(GET), [
			{ slug: 'dune-2021' },
			{ slug: 'dune-1984' },
			{ slug: 'dune-2021' }
		]);
		expect(ratings).toEqual(data);
		expect(GET).toHaveBeenCalledTimes(1);
		expect(GET).toHaveBeenCalledWith('/api/v1/social/ratings', {
			params: { query: { slugs: 'dune-2021,dune-1984' } }
		});
	});

	it('пустая сетка — без запроса; ошибка — без оценок, а не ошибка страницы', async () => {
		const GET = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
		await expect(ratingsFor(client(GET), [])).resolves.toEqual({});
		expect(GET).not.toHaveBeenCalled();
		await expect(ratingsFor(client(GET), [{ slug: 'x' }])).resolves.toEqual({});
	});

	it('не больше 100 slug’ов', async () => {
		const GET = vi.fn().mockResolvedValue({ data: {}, response: new Response(null) });
		await ratingsFor(
			client(GET),
			Array.from({ length: 120 }, (_, i) => ({ slug: `s${i}` }))
		);
		expect(GET.mock.calls[0][1].params.query.slugs.split(',')).toHaveLength(100);
	});
});
