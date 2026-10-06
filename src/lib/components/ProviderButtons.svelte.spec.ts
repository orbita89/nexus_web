import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProviderButtons from './ProviderButtons.svelte';

describe('ProviderButtons', () => {
	it('пустой список (dev) — ничего не рисует', async () => {
		const { container } = render(ProviderButtons, { providers: [] });
		expect(container.querySelectorAll('a')).toHaveLength(0);
		await expect.element(page.getByText('или')).not.toBeInTheDocument();
	});

	it('кнопки ведут на start провайдера полной навигацией', async () => {
		render(ProviderButtons, { providers: ['google', 'yandex'] });
		const yandex = page.getByRole('link', { name: 'Войти через Яндекс' });
		await expect.element(yandex).toHaveAttribute('href', '/api/v1/auth/oauth/yandex/start');
		await expect.element(yandex).toHaveAttribute('data-sveltekit-reload');
		await expect.element(page.getByRole('link', { name: 'Войти через Google' })).toBeVisible();
	});
});
