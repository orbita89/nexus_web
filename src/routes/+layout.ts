import { browser } from '$app/env';
import { ensureSession } from '#lib/auth/session.svelte.ts';

// Сессия восстанавливается в браузере в фоне: публичные страницы не ждут refresh.
export const load = () => {
	if (browser) void ensureSession();
};
