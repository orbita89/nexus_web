// Токены и сессия без привязки к Svelte и браузеру: зависимости передаются снаружи, поэтому
// логику очереди обновления можно проверить unit-тестами.
//
// Access-токен (15 минут) — только в памяти вкладки. Refresh-токен (30 дней) — в localStorage,
// общий для вкладок. Refresh одноразовый: повторное использование заменённого токена бэкенд
// считает кражей и отзывает ВСЕ сессии. Поэтому:
//   - в одной вкладке параллельные обновления склеиваются в один запрос (inflight);
//   - между вкладками обновление идёт под Web Lock, а refresh-токен читается из localStorage
//     уже внутри блокировки — к этому моменту другая вкладка могла его заменить;
//   - новый access рассылается остальным вкладкам (BroadcastChannel), чтобы они не обновлялись зря.

import { ApiError } from '#lib/api/errors.ts';
import type { SchemaTokenResponse, SchemaUserView } from '#lib/api/generated/auth.ts';

export type User = SchemaUserView;
export type TokenResponse = SchemaTokenResponse;

export const REFRESH_KEY = 'nexus.refresh';
const LOCK_NAME = 'nexus.auth.refresh';
/** Access, которому осталось меньше этого, обновляем заранее, а не ждём 401. */
const EXPIRY_MARGIN_MS = 30_000;

type Access = { token: string; expiresAt: number };

type Message = { type: 'tokens'; access: Access; user: User } | { type: 'logout' };

export interface AuthDeps {
	/** Адрес API; '' — тот же домен (браузер). */
	baseUrl?: string;
	fetch: (input: Request) => Promise<Response>;
	storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
	/** navigator.locks; нет (не secure context) — очередь только внутри вкладки. */
	locks?: Pick<LockManager, 'request'> | null;
	channel?: Pick<BroadcastChannel, 'postMessage' | 'onmessage'> | null;
	now?: () => number;
}

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(deps: AuthDeps) {
	const now = deps.now ?? Date.now;
	const base = deps.baseUrl ?? '';
	let access: Access | null = null;
	let user: User | null = null;
	let inflight: Promise<boolean> | null = null;
	let initialized: Promise<void> | null = null;
	const listeners = new Set<(user: User | null) => void>();

	function setUser(next: User | null) {
		user = next;
		for (const listener of listeners) listener(user);
	}

	function isFresh(a: Access | null): a is Access {
		return a !== null && a.expiresAt - now() > EXPIRY_MARGIN_MS;
	}

	function post(path: string, body: unknown): Request {
		return new Request(base + path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
	}

	function withLock<T>(fn: () => Promise<T>): Promise<T> {
		return deps.locks ? deps.locks.request(LOCK_NAME, fn) : fn();
	}

	if (deps.channel) {
		deps.channel.onmessage = (event: MessageEvent<Message>) => {
			const message = event.data;
			if (message.type === 'tokens') {
				access = message.access;
				setUser(message.user);
			} else {
				access = null;
				setUser(null);
			}
		};
	}

	/** Сохранить пару токенов после входа (пароль, письмо, OAuth) или обновления. */
	function signIn(tokens: TokenResponse) {
		deps.storage.setItem(REFRESH_KEY, tokens.refresh_token);
		access = { token: tokens.access_token, expiresAt: now() + tokens.expires_in * 1000 };
		setUser(tokens.user);
		deps.channel?.postMessage({ type: 'tokens', access, user: tokens.user } satisfies Message);
	}

	/** Забыть сессию локально (во всех вкладках), без запроса к серверу. */
	function forget() {
		deps.storage.removeItem(REFRESH_KEY);
		access = null;
		setUser(null);
		deps.channel?.postMessage({ type: 'logout' } satisfies Message);
	}

	async function doRefresh(stale: string | null): Promise<boolean> {
		// Пока ждали блокировку, другая вкладка могла обновиться и прислать свежий access.
		if (isFresh(access) && access.token !== stale) return true;
		const token = deps.storage.getItem(REFRESH_KEY);
		if (!token) {
			if (user || access) forget();
			return false;
		}
		let response: Response;
		try {
			response = await deps.fetch(post('/api/v1/auth/refresh', { refresh_token: token }));
		} catch {
			throw new ApiError(0, null);
		}
		if (response.ok) {
			signIn((await response.json()) as TokenResponse);
			return true;
		}
		if (response.status === 401) {
			// Истёк, отозван выходом или сессии сброшены — входить заново.
			forget();
			return false;
		}
		// 429, 5xx: сессия, скорее всего, жива — токен не трогаем.
		const body = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new ApiError(response.status, body?.error ?? null);
	}

	/**
	 * Обновить пару токенов. `stale` — access, который сервер отверг: если он уже заменён, второй
	 * раз не обновляемся. Возвращает false, если сессии больше нет.
	 */
	function refresh(stale: string | null = access?.token ?? null): Promise<boolean> {
		inflight ??= withLock(() => doRefresh(stale)).finally(() => {
			inflight = null;
		});
		return inflight;
	}

	/** Действующий access-токен (при необходимости обновляется) или null для гостя. */
	async function accessToken(): Promise<string | null> {
		if (isFresh(access)) return access.token;
		if (!deps.storage.getItem(REFRESH_KEY)) return null;
		return (await refresh()) ? access!.token : null;
	}

	/** fetch для API-клиента: подставляет Bearer, на 401 один раз обновляет токен и повторяет. */
	async function authFetch(request: Request): Promise<Response> {
		const retry = request.clone();
		const token = await accessToken();
		if (token) request.headers.set('Authorization', `Bearer ${token}`);
		const response = await deps.fetch(request);
		if (response.status !== 401 || !token) return response;
		if (!(await refresh(token))) return response;
		retry.headers.set('Authorization', `Bearer ${access!.token}`);
		return deps.fetch(retry);
	}

	/** Восстановить сессию при загрузке страницы: один refresh, если есть токен. */
	function init(): Promise<void> {
		initialized ??= (async () => {
			if (!deps.storage.getItem(REFRESH_KEY)) return setUser(null);
			try {
				await refresh();
			} catch {
				// Сеть или 5xx: остаёмся гостем на этой странице, токен сохранён до следующей попытки.
				setUser(null);
			}
		})();
		return initialized;
	}

	/** Выйти на этом устройстве. Под той же блокировкой, что и refresh, чтобы не воскресить сессию. */
	async function logout(): Promise<void> {
		await inflight?.catch(() => {});
		await withLock(async () => {
			const token = deps.storage.getItem(REFRESH_KEY);
			forget();
			if (token) {
				await deps.fetch(post('/api/v1/auth/logout', { refresh_token: token })).catch(() => {});
			}
		});
	}

	/** Выйти на всех устройствах. */
	async function logoutAll(): Promise<void> {
		const response = await authFetch(
			new Request(base + '/api/v1/auth/logout-all', { method: 'POST' })
		);
		if (!response.ok && response.status !== 401) {
			const body = (await response.json().catch(() => null)) as { error?: string } | null;
			throw new ApiError(response.status, body?.error ?? null);
		}
		forget();
	}

	return {
		init,
		signIn,
		forget,
		refresh,
		accessToken,
		authFetch,
		logout,
		logoutAll,
		/** Профиль изменился (PATCH /me, смена email) — обновить без перевыпуска токенов. */
		updateUser(next: User) {
			setUser(next);
		},
		get user() {
			return user;
		},
		subscribe(listener: (user: User | null) => void): () => void {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};
}
