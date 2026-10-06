import { defineConfig, devices } from '@playwright/test';

// E2E против настоящего бэкенда: он должен быть поднят (cd ../nexus_project && make up && make seed).
// Фронтенд собирается и запускается в режиме preview; /api и /ws проксируются на бэкенд.
export default defineConfig({
	testDir: 'e2e',
	// Вход ограничен по IP (30 в минуту): тесты идут последовательно, без повторов.
	workers: 1,
	fullyParallel: false,
	retries: 0,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'retain-on-failure',
		locale: 'ru-RU'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'pnpm build && pnpm preview --port 4173 --strictPort',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
