import { expect, test } from '@playwright/test';

test('разделы каталога рендерятся на сервере, неизвестный — 404', async ({ page, request }) => {
	const html = await (await request.get('/films')).text();
	expect(html).toContain('Фильмы');

	await page.goto('/');
	await page
		.getByRole('navigation', { name: 'Основная навигация' })
		.getByRole('link', { name: 'Книги' })
		.click();
	await expect(page).toHaveURL('/books');
	await expect(page.getByRole('heading', { name: 'Книги' })).toBeVisible();

	expect((await request.get('/comics')).status()).toBe(404);
});

test('поиск из шапки', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('searchbox', { name: 'Поиск по каталогу' }).fill('дюна');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL('/search?q=%D0%B4%D1%8E%D0%BD%D0%B0');
	await expect(page.getByRole('heading', { name: 'Поиск: дюна' })).toBeVisible();
});
