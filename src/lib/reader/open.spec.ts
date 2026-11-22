import { describe, expect, it, vi } from 'vitest';
import { PRIVATE_MAX_AGE_MS, removePrivate, type BookCache, type CachedBook } from './cache.ts';
import { openBook } from './open.ts';

function memoryCache(books: CachedBook[] = []): BookCache & { map: Map<string, CachedBook> } {
	const map = new Map(books.map((b) => [b.slug, b]));
	return {
		map,
		get: async (slug) => map.get(slug) ?? null,
		put: async (b) => void map.set(b.slug, b),
		remove: async (slug) => void map.delete(slug),
		all: async () => [...map.values()],
		clear: async () => map.clear()
	};
}

const blob = new Blob(['epub']);
const copy = (o: Partial<CachedBook> = {}): CachedBook => ({
	slug: 'b',
	blob,
	public: false,
	savedAt: 1000,
	size: 4,
	...o
});
const respond = (status: number) =>
	vi.fn(async () => new Response(status === 200 ? 'epub' : null, { status }));

describe('openBook', () => {
	it('публичная из кэша — без запроса', async () => {
		const fetch = respond(200);
		const cache = memoryCache([copy({ public: true })]);
		const r = await openBook('b', { publicRead: true }, { cache, fetch, now: () => 2000 });
		expect(r.from).toBe('cache');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('публичная без кэша — скачать и сохранить', async () => {
		const cache = memoryCache();
		const r = await openBook(
			'b',
			{ publicRead: true },
			{ cache, fetch: respond(200), now: () => 5 }
		);
		expect(r.from).toBe('network');
		expect(cache.map.get('b')).toMatchObject({ public: true, savedAt: 5 });
	});

	it('закрытая из кэша — сначала HEAD; 200 — копия', async () => {
		const fetch = respond(200);
		const cache = memoryCache([copy()]);
		const r = await openBook('b', { publicRead: false }, { cache, fetch, now: () => 2000 });
		expect(r.from).toBe('cache');
		expect((fetch.mock.calls[0] as unknown as [Request])[0].method).toBe('HEAD');
	});

	it('закрытая: 403 — копия удаляется, ошибка «по приглашению»', async () => {
		const cache = memoryCache([copy()]);
		await expect(
			openBook('b', { publicRead: false }, { cache, fetch: respond(403), now: () => 2000 })
		).rejects.toMatchObject({ kind: 'forbidden' });
		expect(cache.map.has('b')).toBe(false);
	});

	it('закрытая: нет сети — открыть копию', async () => {
		const fetch = vi.fn(async () => {
			throw new TypeError('offline');
		});
		const cache = memoryCache([copy()]);
		const r = await openBook('b', { publicRead: false }, { cache, fetch, now: () => 2000 });
		expect(r.from).toBe('cache');
	});

	it('закрытые копии старше 30 дней удаляются, публичные — нет', async () => {
		const cache = memoryCache([copy({ slug: 'old' }), copy({ slug: 'pub', public: true })]);
		await openBook(
			'pub',
			{ publicRead: true },
			{
				cache,
				fetch: respond(200),
				now: () => 1000 + PRIVATE_MAX_AGE_MS + 1
			}
		);
		expect(cache.map.has('old')).toBe(false);
		expect(cache.map.has('pub')).toBe(true);
	});

	it('гость без доступа — 401 → «войдите»', async () => {
		await expect(
			openBook('b', { publicRead: false }, { cache: memoryCache(), fetch: respond(401) })
		).rejects.toMatchObject({ kind: 'login' });
	});
});

describe('removePrivate', () => {
	it('при выходе — только закрытые', async () => {
		const cache = memoryCache([copy({ slug: 'a' }), copy({ slug: 'p', public: true })]);
		await removePrivate(cache);
		expect([...cache.map.keys()]).toEqual(['p']);
	});
});

describe('openBook: сервер', () => {
	it('503 (архив книги недоступен) — своё сообщение', async () => {
		await expect(
			openBook('b', { publicRead: true }, { cache: memoryCache(), fetch: respond(503) })
		).rejects.toMatchObject({ kind: 'unavailable' });
	});
});
