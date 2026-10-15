import { expect, test } from '@playwright/test';

// Студии: бэкенд заводит их из metadata.studios фильмов (studios::sync), шапку дополняет из TMDB
// при первом открытии — оно может занять 1–2 с.

test('студия: из карточки фильма, шапка, порядок в адресе, неизвестная — 404', async ({
	page,
	request
}) => {
	await page.goto('/films/dune-2021');
	const link = page
		.getByRole('complementary', { name: 'Производство и факты' })
		.getByRole('link')
		.first();
	const name = (await link.textContent())!.trim();
	await link.click();
	await expect(page).toHaveURL(/^[^?]*\/studios\/[a-z0-9-]+$/);
	await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
	await expect(page.getByText(/^\d[\d\s]* фильм(а|ов)? в каталоге$/)).toBeVisible();
	const films = page.getByRole('region', { name: 'Фильмы студии' });
	await expect(films.getByRole('listitem').first()).toBeVisible();

	// Порядок — в адресе; статика одна на студию, выдачу в другом порядке грузит браузер.
	await page.getByLabel('Сортировка').selectOption('title');
	await expect(page).toHaveURL(/\/studios\/[a-z0-9-]+\?sort=title$/);
	await expect(films.locator('[aria-busy="false"]')).toBeVisible();
	await page.reload();
	await expect(page.getByLabel('Сортировка')).toHaveValue('title');
	await expect(films.getByRole('listitem').first()).toBeVisible();

	const missing = await request.get('/studios/no-such-studio');
	expect(missing.status()).toBe(404);
	expect(await missing.text()).toContain('Студия не найдена');
});
