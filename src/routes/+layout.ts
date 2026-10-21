import { browser } from '$app/env';
import { ensureSession } from '#lib/auth/session.svelte.ts';
import type { LayoutLoad } from './$types';

// Сессия восстанавливается в браузере в фоне: публичные страницы не ждут refresh.
// Баннеры приходят из +layout.server.ts — пропускаем дальше.
export const load: LayoutLoad = ({ data }) => {
	if (browser) void ensureSession();
	return data;
};
