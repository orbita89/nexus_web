import { redirect } from '@sveltejs/kit';
import { ensureSession, session } from '#lib/auth/session.svelte.ts';
import { loginUrl } from '#lib/utils/redirect.ts';

// Страницы только для вошедших: личные данные, на сервере не рендерим.
export const ssr = false;

export const load = async ({ url }) => {
	await ensureSession();
	if (!session.user) redirect(307, loginUrl(url));
};
