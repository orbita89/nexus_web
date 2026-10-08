import { expect, test, type Page } from '@playwright/test';
import { registerAndSignIn } from './users';

// Рецензии и оценки. Данные — из make seed (nexus_project/seeds/social.sql): у dune-2021 есть
// рецензии user (9) и author (7). Видео и картинки не нужны — отключаем, чтобы не ходить в сеть.
test.beforeEach(async ({ page }) => {
	await page.route(/^https:\/\/(www\.youtube-nocookie\.com|rutube\.ru|image\.tmdb\.org)\//, (r) =>
		r.abort()
	);
});

const reviewsList = (page: Page) => page.getByRole('list', { name: 'Рецензии' });
const summary = (page: Page) => page.getByRole('region', { name: 'Оценка Nexus' });
const mine = (page: Page) => page.getByRole('region', { name: 'Ваша оценка' });

// Карточка статическая: сводка и рецензии вернутся клиентскими блоками (ленивая загрузка).
test.fixme('гость: сводка, рецензии, сортировка и «Все рецензии»', async ({ page, request }) => {
	const rating = await (await request.get('/api/v1/social/entities/dune-2021/rating')).json();

	await page.goto('/films/dune-2021');
	const hero = page.getByRole('region', { name: 'Шапка: Дюна' });
	const average = rating.average.toLocaleString('ru-RU', { minimumFractionDigits: 1 });
	await expect(hero.getByLabel(`Средняя оценка ${average} из 10`)).toBeVisible();
	await expect(summary(page)).toContainText(average);
	await expect(reviewsList(page)).toContainText('Вильнёв сделал невозможное');
	await expect(mine(page).getByRole('link', { name: 'Войдите' })).toHaveAttribute(
		'href',
		'/auth/login?next=%2Ffilms%2Fdune-2021'
	);

	await page.getByRole('link', { name: 'Сначала высокие' }).click();
	await expect(page).toHaveURL('/films/dune-2021?sort=rating_desc');
	const ratings = await reviewsList(page)
		.getByLabel(/^Оценка \d+ из 10$/)
		.allTextContents();
	expect(ratings.map(Number)).toEqual([...ratings.map(Number)].sort((a, b) => b - a));

	await page.getByRole('link', { name: /^Все рецензии/ }).click();
	await expect(page).toHaveURL('/films/dune-2021/reviews?sort=rating_desc');
	await expect(page.getByRole('heading', { name: 'Рецензии: Дюна', level: 1 })).toBeVisible();
	await expect(reviewsList(page)).toContainText('Вильнёв сделал невозможное');
});

// Карточка статическая: сводка и рецензии вернутся клиентскими блоками (ленивая загрузка).
test.fixme('вошедший: оценка, рецензия, правка, удаление; сводка и профиль обновляются', async ({
	page,
	request
}) => {
	const { username } = await registerAndSignIn(page, request, 'rev');
	const before = (await (await request.get('/api/v1/social/entities/dune-2021/rating')).json())
		.count as number;
	const counted = (n: number) => new RegExp(`${n} оцен(ка|ки|ок)`);

	await page.goto('/films/dune-2021');
	await expect(summary(page)).toContainText(counted(before));

	// Оценка сохраняется по клику.
	await mine(page).getByRole('button', { name: 'Оценка 8' }).click();
	await expect(mine(page).getByRole('button', { name: 'Оценка 8' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(summary(page)).toContainText(counted(before + 1));

	// Рецензия: оценка остаётся, текст появляется в списке.
	const text = `E2E: атмосфера и звук, ${Date.now()}`;
	await mine(page).getByRole('button', { name: 'Написать рецензию' }).click();
	await mine(page).getByLabel('Текст рецензии').fill(text);
	await mine(page).getByRole('button', { name: 'Сохранить' }).click();
	const item = reviewsList(page).getByRole('article').filter({ hasText: text });
	await expect(item).toBeVisible();
	await expect(item.getByLabel('Оценка 8 из 10')).toBeVisible();

	// Правка заменяет текст.
	await mine(page).getByRole('button', { name: 'Изменить рецензию' }).click();
	await mine(page).getByLabel('Текст рецензии').fill(`${text} (дополнено)`);
	await mine(page).getByRole('button', { name: 'Сохранить' }).click();
	await expect(reviewsList(page)).toContainText(`${text} (дополнено)`);

	// В профиле — тоже.
	await page.goto(`/u/${username}/reviews`);
	await expect(page.getByRole('article').filter({ hasText: 'дополнено' })).toContainText('Дюна');

	// Удаление: рецензии нет, сводка вернулась.
	await page.goto('/films/dune-2021');
	await mine(page).getByRole('button', { name: 'Удалить', exact: true }).click();
	await mine(page).getByRole('button', { name: 'Удалить', exact: true }).click();
	await expect(mine(page).getByRole('button', { name: 'Написать рецензию' })).toBeVisible();
	await expect(reviewsList(page)).not.toContainText(text);
	await expect(summary(page)).toContainText(counted(before));
});

test('рецензии неизвестного пользователя и произведения — 404', async ({ request }) => {
	expect((await request.get('/u/no-such-user-e2e/reviews')).status()).toBe(404);
	expect((await request.get('/films/no-such-entity/reviews')).status()).toBe(404);
	const wrong = await request.get('/books/dune-2021/reviews', { maxRedirects: 0 });
	expect(wrong.status()).toBe(301);
	expect(wrong.headers()['location']).toBe('/films/dune-2021/reviews');
});
