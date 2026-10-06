import { expect, test } from '@playwright/test';

// Каталог публичный: без входа, данные — из make seed (nexus_project/seeds/catalog.sql).

test('раздел: фильтр по тегу меняет адрес и выдачу, «назад» возвращает', async ({ page }) => {
	await page.goto('/films');
	await expect(page.getByRole('heading', { name: 'Фильмы', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Дюна\s+2021/ })).toBeVisible();

	await page.getByLabel('Тег').selectOption({ label: 'Ужасы' });
	await expect(page).toHaveURL('/films?tag=horror');
	await expect(page.getByRole('heading', { name: 'Фильмы · Ужасы', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Сияние\s+1980/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Дюна\s+2021/ })).toHaveCount(0);

	await page.goBack();
	await expect(page).toHaveURL('/films');
	await expect(page.getByRole('link', { name: /^Дюна\s+2021/ })).toBeVisible();

	// Ссылкой можно поделиться: тот же адрес с нуля даёт ту же выдачу.
	await page.goto('/films?tag=horror&q=%D1%81%D0%B8%D1%8F');
	await expect(page.getByLabel('Тег')).toHaveValue('horror');
	await expect(page.getByRole('searchbox', { name: 'Название' })).toHaveValue('сия');
	await expect(page.getByRole('link', { name: /^Сияние\s+1980/ })).toBeVisible();
});

test('карточка: участники и оценка, переход на человека и обратно к работе', async ({
	page,
	request
}) => {
	const rating = await (await request.get('/api/v1/social/entities/dune-2021/rating')).json();
	expect(rating.count).toBeGreaterThan(0);

	await page.goto('/films/dune-2021');
	await expect(page.getByRole('heading', { name: 'Дюна', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Научная фантастика' })).toBeVisible();
	await expect(page.getByText('2 ч 35 мин')).toBeVisible();

	const summary = page.getByRole('region', { name: 'Оценка Nexus' });
	await expect(summary).toContainText(
		rating.average.toLocaleString('ru-RU', { minimumFractionDigits: 1 })
	);
	await expect(
		summary.getByRole('list', { name: 'Распределение оценок' }).getByRole('listitem')
	).toHaveCount(10);

	const credits = page.getByRole('region', { name: 'Участники' });
	await expect(credits).toContainText('Актёр · Пол Атрейдес');
	await credits.getByRole('link', { name: /Дени Вильнёв/ }).click();

	await expect(page).toHaveURL('/people/denis-villeneuve');
	await expect(page.getByRole('heading', { name: 'Дени Вильнёв', level: 1 })).toBeVisible();
	const work = page.getByRole('link', { name: /^Дюна\s+2021 · Фильм\s+Режиссёр/ });
	await expect(work).toBeVisible();
	await work.click();
	await expect(page).toHaveURL('/films/dune-2021');
});

test('чужой раздел в адресе — 301 на правильный, неизвестный slug — 404', async ({ request }) => {
	const wrong = await request.get('/books/dune-2021?x=1', { maxRedirects: 0 });
	expect(wrong.status()).toBe(301);
	expect(wrong.headers()['location']).toBe('/films/dune-2021?x=1');

	expect((await request.get('/films/no-such-entity')).status()).toBe(404);
	expect((await request.get('/people/no-such-person')).status()).toBe(404);
	expect((await request.get('/tags/no-such-tag')).status()).toBe(404);
});

test('карточка рендерится на сервере: заголовок и описание в HTML без JS', async ({
	request,
	browser
}) => {
	const html = await (await request.get('/films/dune-2021')).text();
	expect(html).toContain('<title>Дюна (2021) — Nexus</title>');
	expect(html).toMatch(/<meta name="description" content="Первая часть экранизации/);
	expect(html).toContain('Дени Вильнёв');

	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/films/dune-2021');
	await expect(page.getByRole('heading', { name: 'Дюна', level: 1 })).toBeVisible();
	await context.close();
});

test('теги: список и сущности с тегом, фильтр по разделу', async ({ page }) => {
	await page.goto('/tags');
	await page.getByRole('link', { name: /Научная фантастика/ }).click();
	await expect(page).toHaveURL('/tags/sci-fi');
	await expect(page.getByRole('heading', { name: 'Научная фантастика', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Дюна\s+1965 · Книга/ })).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Раздел' })
		.getByRole('link', { name: 'Фильмы' })
		.click();
	await expect(page).toHaveURL('/tags/sci-fi?kind=films');
	await expect(page.getByRole('link', { name: /^Дюна\s+1965/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /^Дюна\s+2021/ })).toBeVisible();
});

test('люди: поиск по имени', async ({ page }) => {
	await page.goto('/people');
	await page.getByRole('searchbox', { name: 'Поиск по имени' }).fill('кинг');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL('/people?q=%D0%BA%D0%B8%D0%BD%D0%B3');
	await page.getByRole('link', { name: /Стивен Кинг/ }).click();
	await expect(page.getByRole('heading', { name: 'Стивен Кинг', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /Сияние\s+1977 · Книга\s+Автор/ })).toBeVisible();
});

test('поиск: результаты, пустой запрос — подсказка', async ({ page }) => {
	await page.goto('/search');
	await expect(page.getByText('Ищите по названию')).toBeVisible();
	await page.getByRole('link', { name: 'Дюна', exact: true }).click();
	await expect(page).toHaveURL('/search?q=%D0%94%D1%8E%D0%BD%D0%B0');
	await expect(page.getByRole('link', { name: /^Дюна\s+2021 · Фильм/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Дюна\s+1965 · Книга/ })).toBeVisible();
});
