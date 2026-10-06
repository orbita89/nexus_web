import type { Handle, HandleFetch } from '@sveltejs/kit/hooks';
import { BACKEND_URL } from '$app/env/private';

// SSR: load-функции запрашивают API по адресу самого фронтенда (event.fetch с url.origin),
// а здесь такие запросы уходят на бэкенд. В браузере то же делает прокси Vite / nginx.
export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
	const url = new URL(request.url);
	if (url.origin === event.url.origin && url.pathname.startsWith('/api/')) {
		const target = new URL(url.pathname + url.search, BACKEND_URL);
		return fetch(new Request(target, request));
	}
	return fetch(request);
};

// Заголовки ответов API, которые можно читать в load-функциях на сервере (по умолчанию SvelteKit
// запрещает все, чтобы не разойтись с браузером при гидрации): openapi-fetch смотрит
// Content-Length (пустой ответ), unwrap() — Retry-After у 429.
const READABLE_HEADERS = new Set(['content-length', 'transfer-encoding', 'retry-after']);

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, { filterSerializedResponseHeaders: (name) => READABLE_HEADERS.has(name) });
