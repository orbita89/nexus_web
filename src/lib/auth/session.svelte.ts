// Сессия в браузере: единственный экземпляр Auth и реактивное состояние для компонентов.
// На сервере (SSR) сессии нет: страницы рендерятся как для гостя, личное догружается в браузере.

import { browser } from '$app/env';
import { createApi } from '#lib/api/client.ts';
import { createAuth, type Auth, type TokenResponse, type User } from './core';

export type { User };

class Session {
	user = $state<User | null>(null);
	/** loading — ещё не знаем (SSR или идёт первый refresh). */
	status = $state<'loading' | 'guest' | 'authed'>('loading');
}

export const session = new Session();

const auth: Auth | null = browser
	? createAuth({
			fetch: (request) => fetch(request),
			storage: localStorage,
			locks: 'locks' in navigator ? navigator.locks : null,
			channel: 'BroadcastChannel' in window ? new BroadcastChannel('nexus.auth') : null
		})
	: null;

let ready: Promise<void> | null = null;

/** Начать восстановление сессии (один раз) и дождаться его. На сервере — сразу. */
export function ensureSession(): Promise<void> {
	if (!auth) return Promise.resolve();
	ready ??= auth.init().then(() => {
		auth.subscribe(apply);
		apply(auth.user);
	});
	return ready;
}

function apply(user: User | null) {
	session.user = user;
	session.status = user ? 'authed' : 'guest';
}

function requireAuth(): Auth {
	if (!auth) throw new Error('auth is available only in the browser');
	return auth;
}

/** API от имени текущего пользователя (Bearer, обновление токена в очереди). Только в браузере. */
export const api = createApi({
	baseUrl: '',
	fetch: (request) => requireAuth().authFetch(request)
});

/** API без токена — для входа, регистрации и ссылок из писем. */
export const guestApi = createApi({ baseUrl: '', fetch: (request) => fetch(request) });

export function signIn(tokens: TokenResponse) {
	requireAuth().signIn(tokens);
	ready ??= Promise.resolve();
	apply(tokens.user);
}

export const logout = () => requireAuth().logout();
export const logoutAll = () => requireAuth().logoutAll();
export const forgetSession = () => requireAuth().forget();
export const accessToken = () => requireAuth().accessToken();
export const updateUser = (user: User) => requireAuth().updateUser(user);
