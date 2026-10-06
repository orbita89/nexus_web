import type { HandleFetch } from '@sveltejs/kit/hooks';
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
