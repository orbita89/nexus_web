import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

// Бэкенд без CORS: в dev и preview браузер ходит на /api и /ws этого же адреса, а Vite проксирует
// их на nginx бэкенда. В проде фронтенд и API на одном домене за nginx.
const backend = process.env.BACKEND_URL ?? 'http://localhost';
const proxy = {
	'/api': { target: backend, changeOrigin: false },
	'/ws': { target: backend, ws: true, changeOrigin: false }
};

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Сжатые .br/.gz рядом с ассетами и пререндером — nginx отдаёт их сам (gzip_static,
			// brotli_static). Карточки ISR пересжимает при перерисовке (server/isr.js).
			adapter: adapter({ precompress: true }),
			paths: {
				// Публичный адрес сайта: при пререндере и ISR это url.origin, он попадает в og:url
				// статических карточек. Пусто (dev, CI) — origin берётся из запроса.
				origin: process.env.ORIGIN || undefined
			},
			prerender: {
				// Пререндерим только карточки — их список даёт entries() маршрута, обходить ссылки не нужно.
				crawl: false,
				// Карточка — один запрос к API; запросы ждут сеть, а не CPU.
				concurrency: 16,
				handleHttpError: ({ status, path, message }) => {
					// Произведение удалили во время сборки — его просто не будет в статике.
					if (status === 404) return console.warn(`prerender: ${path} — 404, пропускаем`);
					throw new Error(message);
				}
			}
		})
	],
	server: { proxy },
	preview: { proxy },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
