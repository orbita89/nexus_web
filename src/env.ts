import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	BACKEND_URL: {
		description:
			'Адрес бэкенда (nginx) для запросов с сервера SvelteKit (SSR). Браузер ходит на /api этого же домена.',
		schema: (value) => value || 'http://localhost'
	}
});
