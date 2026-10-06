import { expect, test, type Page } from '@playwright/test';

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

test('карточка: участники, переход на человека и обратно к работе', async ({ page }) => {
	await page.goto('/films/dune-2021');
	await expect(page.getByRole('heading', { name: 'Дюна', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Научная фантастика' })).toBeVisible();
	await expect(page.getByText('2 ч 35 мин')).toBeVisible();
	// Трейлера в API пока нет — постер на месте, блока трейлера нет. Оценки временно скрыты.
	await expect(page.getByRole('img', { name: 'Обложка: Дюна' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Трейлер' })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Оценка Nexus' })).toHaveCount(0);

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

// Поля trailer_url в API пока нет (docs/backend-questions.md): подмешиваем его в ответ при переходе
// в браузере, видео — маленький webm из e2e/fixtures.
async function withTrailer(page: Page, video: 'ok' | 'broken') {
	await page.route('**/api/v1/catalog/entities/dune-2021', async (route) => {
		const response = await route.fetch();
		const json = await response.json();
		await route.fulfill({ response, json: { ...json, trailer_url: '/test-trailer.webm' } });
	});
	await page.route('**/test-trailer.webm', (route) =>
		video === 'ok'
			? route.fulfill({ path: 'e2e/fixtures/trailer.webm', contentType: 'video/webm' })
			: route.fulfill({ status: 404 })
	);
	await page.goto('/films');
	await page.getByRole('link', { name: /^Дюна\s+2021/ }).click();
	await expect(page.getByRole('heading', { name: 'Дюна', level: 1 })).toBeVisible();
}

const isPlaying = (v: HTMLVideoElement) => !v.paused;

test('трейлер: сам запускается без звука, звук и пауза — кнопками, постер остаётся', async ({
	page
}) => {
	await withTrailer(page, 'ok');
	const hero = page.getByRole('region', { name: 'Трейлер' });
	const video = hero.locator('video');
	await expect(video).toHaveAttribute('src', '/test-trailer.webm');
	await expect.poll(() => video.evaluate(isPlaying)).toBe(true);
	expect(await video.evaluate((v: HTMLVideoElement) => v.muted && v.loop)).toBe(true);

	await hero.getByRole('button', { name: 'Включить звук' }).click();
	expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
	await expect(hero.getByRole('button', { name: 'Выключить звук' })).toBeVisible();

	await hero.getByRole('button', { name: 'Пауза' }).click();
	await expect.poll(() => video.evaluate(isPlaying)).toBe(false);
	await hero.getByRole('button', { name: 'Смотреть трейлер' }).click();
	await expect.poll(() => video.evaluate(isPlaying)).toBe(true);

	await expect(page.getByRole('img', { name: 'Обложка: Дюна' })).toBeVisible();
});

test('трейлер: при prefers-reduced-motion сам не запускается', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await withTrailer(page, 'ok');
	const hero = page.getByRole('region', { name: 'Трейлер' });
	await expect(hero.getByRole('button', { name: 'Смотреть трейлер' })).toBeVisible();
	expect(await hero.locator('video').evaluate(isPlaying)).toBe(false);
});

test('трейлер не загрузился — карточка как без него', async ({ page }) => {
	await withTrailer(page, 'broken');
	await expect(page.getByRole('region', { name: 'Трейлер' })).toHaveCount(0);
	await expect(page.getByRole('img', { name: 'Обложка: Дюна' })).toBeVisible();
});
