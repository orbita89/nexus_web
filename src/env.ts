import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	BACKEND_URL: {
		description:
			'Адрес бэкенда (nginx) для запросов с сервера SvelteKit (SSR). Браузер ходит на /api этого же домена.',
		schema: (value) => value || 'http://localhost'
	},
	PRERENDER_ENTITIES: {
		description:
			'Сборка: 1 — пререндерить карточки всего каталога (нужен живой BACKEND_URL). Пусто — карточки рендерятся при первом запросе (dev, CI, e2e).',
		static: true,
		schema: (value) => value === '1'
	}
});
