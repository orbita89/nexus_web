import { describe, expect, it, vi } from 'vitest';
import { listMyMarks, markLabels } from './marks';

describe('markLabels', () => {
	it('подписи по типу', () => {
		expect(markLabels('movie')).toEqual({ later: 'Посмотреть позже', done: 'Просмотрено' });
		expect(markLabels('book').done).toBe('Прочитано');
		expect(markLabels('game').later).toBe('Пройти позже');
	});
});

describe('listMyMarks', () => {
	it('GET /users/me/marks с видом и страницей', async () => {
		const page = { items: [], total: 0, limit: 24, offset: 24 };
		const GET = vi.fn().mockResolvedValue({ data: page, response: new Response(null) });
		const client = { social: { GET } } as unknown as Parameters<typeof listMyMarks>[0];
		await expect(listMyMarks(client, 'later', { offset: 24 })).resolves.toEqual(page);
		expect(GET).toHaveBeenCalledWith('/api/v1/social/users/me/marks', {
			params: { query: { kind: 'later', limit: 24, offset: 24 } }
		});
	});
});
