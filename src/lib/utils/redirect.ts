/**
 * Куда вернуть пользователя после входа. Только пути этого сайта: `?next=//evil.com` или
 * `?next=https://...` — открытый редирект, их отбрасываем.
 */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
		return fallback;
	}
	return next;
}

/** Адрес страницы входа с возвратом на текущую страницу. */
export function loginUrl(from: { pathname: string; search: string }): string {
	const next = from.pathname + from.search;
	return next === '/' ? '/auth/login' : `/auth/login?next=${encodeURIComponent(next)}`;
}
