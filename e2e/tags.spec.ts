import { expect, test } from '@playwright/test';

// Справочник тегов: вкладки разделов сужают список запросом к API (?entity_kind=), счётчик
// в разделе — словами раздела. Описания тегов заполняются через админку, на деве они есть
// у нескольких жанров (make seed).

test('теги: вкладка раздела сужает список и меняет счётчик', async ({ page }) => {
	await page.goto('/tags');
	const genres = page.getByRole('region', { name: 'Жанры' });
	await expect(genres.getByRole('listitem').first()).toBeVisible();
	const all = await genres.getByRole('listitem').count();
	await expect(page.getByText(/^\d[\d\s]* произведени(е|я|й)$/).first()).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Раздел' })
		.getByRole('link', { name: 'Картины' })
		.click();
	await expect(page).toHaveURL('/tags?kind=paintings');
	await expect(genres.getByRole('listitem').first()).toBeVisible();
	expect(await genres.getByRole('listitem').count()).toBeLessThan(all);
	await expect(page.getByText(/^\d[\d\s]* картин(а|ы|)$/).first()).toBeVisible();

	// Жанры картин — только у картин: «Боевика» (фильмы) в этом разделе нет.
	await expect(genres.getByRole('link', { name: 'Боевик', exact: true })).toHaveCount(0);
});

test('страница тега: описание в шапке', async ({ page, request }) => {
	const tag = await (await request.get('/api/v1/catalog/tags/drama')).json();
	// Описания пишут руками через админку; на базе без сида их нет — проверять нечего.
	test.skip(!tag.description, 'у жанра «Драма» нет описания (make seed)');

	await page.goto('/tags/drama');
	await expect(page.getByRole('heading', { name: 'Драма', level: 1 })).toBeVisible();
	await expect(page.locator('header').getByText(tag.description)).toBeVisible();
});
