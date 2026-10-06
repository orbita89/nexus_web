import createClient from 'openapi-fetch';
import type { paths as AuthPaths } from './generated/auth';
import type { paths as CatalogPaths } from './generated/catalog';
import type { paths as SocialPaths } from './generated/social';

export interface ApiOptions {
	/** '' в браузере (тот же домен), `url.origin` в load-функциях — на сервере нужен абсолютный адрес. */
	baseUrl: string;
	fetch: (input: Request) => Promise<Response>;
}

/** Клиенты трёх контрактов бэкенда. Пути в контрактах уже полные: '/api/v1/auth/...'. */
export function createApi(options: ApiOptions) {
	return {
		auth: createClient<AuthPaths>(options),
		catalog: createClient<CatalogPaths>(options),
		social: createClient<SocialPaths>(options)
	};
}

export type Api = ReturnType<typeof createApi>;

/**
 * Клиент для load-функций (`+page.ts`): публичные данные, без токена. На сервере запросы идут
 * через event.fetch, а hooks.server.ts (handleFetch) отправляет их на бэкенд.
 */
export function publicApi(fetch: typeof globalThis.fetch, url: URL): Api {
	return createApi({ baseUrl: url.origin, fetch: (request) => fetch(request) });
}
