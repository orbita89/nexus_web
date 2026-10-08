import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	BACKEND_URL: {
		description:
			'Адрес бэкенда (nginx) для запросов с сервера SvelteKit (SSR). Браузер ходит на /api этого же домена.',
		schema: (value) => value || 'http://localhost'
	},
	PRERENDER_ENTITIES: {
		description:
			'Сборка: пререндерить карточки всего каталога (по умолчанию да, нужен живой BACKEND_URL). 0 — не пререндерить: карточки рендерятся при первом запросе (CI без бэкенда).',
		static: true,
		schema: (value) => value !== '0'
	}
});
