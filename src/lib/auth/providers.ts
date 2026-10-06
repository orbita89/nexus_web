import { guestApi } from './session.svelte.ts';

/** Включённые OAuth-провайдеры. Ошибка — как будто их нет: вход по паролю и ссылке работает и так. */
export async function loadProviders(): Promise<string[]> {
	try {
		const { data } = await guestApi.auth.GET('/api/v1/auth/oauth/providers');
		return data?.providers ?? [];
	} catch {
		return [];
	}
}
