import { describe, expect, it, vi } from 'vitest';
import { createAuth, REFRESH_KEY, type AuthDeps, type User } from './core';

const BASE = 'http://test';

const user: User = {
	id: '00000000-0000-0000-0000-000000000003',
	email: 'user@nexus.local',
	username: 'user',
	role: 'user',
	is_active: true,
	created_at: '2026-01-01T00:00:00Z'
};

/** Бэкенд как в auth.md: refresh одноразовый, повтор заменённого токена отзывает все сессии. */
function fakeBackend() {
	let n = 0;
	const active = new Set<string>();
	const replaced = new Set<string>();
	const accessValid = new Set<string>();
	const state = { theft: false, refreshCalls: 0, refreshStatus: 200 };

	function issue() {
		n += 1;
		active.add(`r${n}`);
		accessValid.add(`a${n}`);
		return {
			access_token: `a${n}`,
			refresh_token: `r${n}`,
			expires_in: 900,
			token_type: 'Bearer',
			user
		};
	}

	const json = (body: unknown, status = 200) =>
		new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

	const fetch = vi.fn(async (request: Request): Promise<Response> => {
		await Promise.resolve();
		const path = new URL(request.url).pathname;
		if (path === '/api/v1/auth/refresh') {
			state.refreshCalls += 1;
			if (state.refreshStatus !== 200) return json({ error: 'boom' }, state.refreshStatus);
			const { refresh_token } = (await request.json()) as { refresh_token: string };
			if (replaced.has(refresh_token)) {
				state.theft = true;
				active.clear();
				return json({ error: 'unauthorized' }, 401);
			}
			if (!active.delete(refresh_token)) return json({ error: 'unauthorized' }, 401);
			replaced.add(refresh_token);
			return json(issue());
		}
		if (path === '/api/v1/auth/logout') {
			const { refresh_token } = (await request.json()) as { refresh_token: string };
			active.delete(refresh_token);
			return new Response(null, { status: 204 });
		}
		const token = request.headers.get('Authorization')?.replace('Bearer ', '');
		if (!token || !accessValid.has(token)) return json({ error: 'unauthorized' }, 401);
		return json({ ok: true, token });
	});

	return { fetch, state, issue, accessValid };
}

function memoryStorage(): AuthDeps['storage'] {
	const map = new Map<string, string>();
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k)
	};
}

/** Общая блокировка «браузера» — как navigator.locks: колбэки по одному. */
function fakeLocks(): NonNullable<AuthDeps['locks']> {
	let tail: Promise<unknown> = Promise.resolve();
	return {
		request: ((_name: string, cb: () => Promise<unknown>) => {
			const run = tail.then(cb);
			tail = run.catch(() => {});
			return run;
		}) as LockManager['request']
	};
}

/** Каналы вкладок: сообщение получают все, кроме отправителя (как BroadcastChannel). */
function fakeChannels(count: number) {
	const channels = Array.from({ length: count }, () => ({
		onmessage: null as ((e: MessageEvent) => void) | null,
		postMessage(data: unknown) {
			for (const other of channels) {
				if (other !== this) setTimeout(() => other.onmessage?.({ data } as MessageEvent));
			}
		}
	}));
	return channels as unknown as NonNullable<AuthDeps['channel']>[];
}

describe('auth core', () => {
	it('параллельные запросы в одной вкладке — один refresh', async () => {
		const backend = fakeBackend();
		const storage = memoryStorage();
		storage.setItem(REFRESH_KEY, backend.issue().refresh_token);
		const auth = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage });

		const tokens = await Promise.all([auth.accessToken(), auth.accessToken(), auth.accessToken()]);

		expect(backend.state.refreshCalls).toBe(1);
		expect(new Set(tokens).size).toBe(1);
		expect(storage.getItem(REFRESH_KEY)).toBe('r2');
	});

	it('две вкладки обновляются одновременно — без «кражи» и разлогина', async () => {
		const backend = fakeBackend();
		const storage = memoryStorage();
		storage.setItem(REFRESH_KEY, backend.issue().refresh_token);
		const locks = fakeLocks();
		const [c1, c2] = fakeChannels(2);
		const tab1 = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage, locks, channel: c1 });
		const tab2 = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage, locks, channel: c2 });

		const [t1, t2] = await Promise.all([tab1.accessToken(), tab2.accessToken()]);

		expect(backend.state.theft).toBe(false);
		expect(t1).not.toBeNull();
		expect(t2).not.toBeNull();
		expect(tab1.user?.username).toBe('user');
		expect(tab2.user?.username).toBe('user');
	});

	it('без общей блокировки две вкладки разлогинили бы пользователя (проверка самого теста)', async () => {
		const backend = fakeBackend();
		const storage = memoryStorage();
		storage.setItem(REFRESH_KEY, backend.issue().refresh_token);
		const tab1 = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage });
		const tab2 = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage });

		await Promise.all([tab1.accessToken(), tab2.accessToken()]);

		expect(backend.state.theft).toBe(true);
	});

	it('401 на запрос — обновить токен и повторить один раз', async () => {
		const backend = fakeBackend();
		const storage = memoryStorage();
		const auth = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage });
		auth.signIn(backend.issue());
		backend.accessValid.clear(); // access «истёк» раньше срока

		const response = await auth.authFetch(new Request(`${BASE}/api/v1/auth/me`));

		expect(response.status).toBe(200);
		expect(((await response.json()) as { token: string }).token).toBe('a2');
		expect(backend.state.refreshCalls).toBe(1);
	});

	it('refresh отклонён (401) — сессия забыта', async () => {
		const backend = fakeBackend();
		const storage = memoryStorage();
		storage.setItem(REFRESH_KEY, 'revoked');
		const auth = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage });
		const listener = vi.fn();
		auth.subscribe(listener);

		await auth.init();

		expect(storage.getItem(REFRESH_KEY)).toBeNull();
		expect(auth.user).toBeNull();
		expect(listener).toHaveBeenLastCalledWith(null);
	});

	it('сбой сервера при refresh — токен не теряется', async () => {
		const backend = fakeBackend();
		const storage = memoryStorage();
		storage.setItem(REFRESH_KEY, backend.issue().refresh_token);
		backend.state.refreshStatus = 503;
		const auth = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage });

		await expect(auth.accessToken()).rejects.toMatchObject({ status: 503 });
		expect(storage.getItem(REFRESH_KEY)).toBe('r1');
	});

	it('гость: без refresh-токена запросы идут без Authorization', async () => {
		const backend = fakeBackend();
		const auth = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage: memoryStorage() });

		const response = await auth.authFetch(new Request(`${BASE}/api/v1/catalog/entities`));

		expect(response.status).toBe(401);
		expect(backend.state.refreshCalls).toBe(0);
	});

	it('выход отзывает refresh на сервере и разлогинивает другие вкладки', async () => {
		const backend = fakeBackend();
		const storage = memoryStorage();
		const locks = fakeLocks();
		const [c1, c2] = fakeChannels(2);
		const tab1 = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage, locks, channel: c1 });
		const tab2 = createAuth({ baseUrl: BASE, fetch: backend.fetch, storage, locks, channel: c2 });
		tab1.signIn(backend.issue());
		await new Promise((r) => setTimeout(r));
		expect(tab2.user).not.toBeNull();

		await tab1.logout();
		await new Promise((r) => setTimeout(r));

		expect(storage.getItem(REFRESH_KEY)).toBeNull();
		expect(tab2.user).toBeNull();
		const calls = backend.fetch.mock.calls.map(([r]) => new URL(r.url).pathname);
		expect(calls).toContain('/api/v1/auth/logout');
	});
});
