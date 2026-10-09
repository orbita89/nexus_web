import { expect, test, type Page } from '@playwright/test';
import { registerAndSignIn } from './users';

// Рецензии и оценки. Данные — из make seed (nexus_project/seeds/social.sql): у dune-2021 есть
// рецензии user (9) и author (7). Видео и картинки не нужны — отключаем, чтобы не ходить в сеть.
test.beforeEach(async ({ page }) => {
	await page.route(/^https:\/\/(www\.youtube-nocookie\.com|rutube\.ru|image\.tmdb\.org)\//, (r) =>
		r.abort()
	);
});

const reviewsList = (page: Page) => page.getByRole('list', { name: /^Рецензии/ });
const hero = (page: Page) => page.getByRole('region', { name: 'Шапка: Дюна' });
const average = (page: Page) => hero(page).getByLabel(/^Средняя оценка/);
/** «Оценить» в шапке — <details>: панель с 1–10 и реакциями. */
const rateToggle = (page: Page) => hero(page).locator('summary');
const ratePanel = (page: Page) => page.getByRole('region', { name: 'Ваша оценка' });
/** Лента на карточке — ленивая: монтируется, когда до неё долистали. */
const toFeed = (page: Page) => page.locator('#activity').scrollIntoViewIfNeeded();
const feed = (page: Page) => page.getByRole('region', { name: 'Рецензии и обсуждения' });

test('гость: средняя в шапке ведёт ко всем рецензиям, «Оценить» — ко входу', async ({
	page,
	request
}) => {
	const rating = await (await request.get('/api/v1/social/entities/dune-2021/rating')).json();
	const text = rating.average.toLocaleString('ru-RU', { minimumFractionDigits: 1 });

	await page.goto('/films/dune-2021');
	await expect(hero(page).getByLabel(`Средняя оценка ${text} из 10`)).toBeVisible();
	await expect(hero(page).getByRole('link', { name: 'Оценить' })).toHaveAttribute(
		'href',
		'/auth/login?next=%2Ffilms%2Fdune-2021'
	);

	await toFeed(page);
	await expect(reviewsList(page)).toContainText('Вильнёв сделал невозможное');
	// Под рецензией — 👍 / 👎 и комментарии; гостю голос ведёт ко входу.
	const seeded = reviewsList(page)
		.getByRole('article')
		.filter({ hasText: 'Вильнёв сделал невозможное' });
	await expect(seeded.getByRole('link', { name: 'Нравится', exact: true })).toHaveAttribute(
		'href',
		'/auth/login?next=%2Ffilms%2Fdune-2021'
	);
	await seeded.getByRole('button', { name: /Комментарии/ }).click();
	await expect(seeded).toContainText('Войдите, чтобы комментировать');

	await average(page).click();
	await expect(page).toHaveURL('/films/dune-2021/reviews');
	await expect(page.getByRole('heading', { name: 'Рецензии: Дюна', level: 1 })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Оценка Nexus' })).toContainText(text);

	await page.getByRole('link', { name: 'Сначала высокие' }).click();
	await expect(page).toHaveURL('/films/dune-2021/reviews?sort=rating_desc');
	const ratings = await reviewsList(page)
		.getByLabel(/^Оценка \d+ из 10$/)
		.allTextContents();
	expect(ratings.map(Number)).toEqual([...ratings.map(Number)].sort((a, b) => b - a));
});

test('вошедший: «Оценить» в шапке, рецензия в ленте, правка, удаление', async ({
	page,
	request
}) => {
	const { username } = await registerAndSignIn(page, request, 'rev');
	const before = (await (await request.get('/api/v1/social/entities/dune-2021/rating')).json())
		.count as number;
	const counted = (n: number) => new RegExp(`, ${n} оцен(ка|ки|ок)$`);

	await page.goto('/films/dune-2021');
	await expect(average(page)).toHaveAttribute('aria-label', counted(before));

	// Оценка сохраняется по клику, панель закрывается, кнопка показывает оценку.
	await rateToggle(page).click();
	await ratePanel(page).getByRole('button', { name: 'Оценка 8' }).click();
	await expect(rateToggle(page)).toHaveText(/Ваша: 8/);
	await expect(ratePanel(page)).toBeHidden();
	await expect(average(page)).toHaveAttribute('aria-label', counted(before + 1));

	// Реакция — переключатель.
	await rateToggle(page).click();
	const fire = page.getByRole('group', { name: 'Реакции' }).getByRole('button', { name: 'Огонь' });
	await fire.click();
	await expect(fire).toHaveAttribute('aria-pressed', 'true');

	// «Написать рецензию» из панели открывает форму в ленте; оценка остаётся.
	const text = `E2E: атмосфера и звук, ${Date.now()}`;
	await ratePanel(page).getByRole('button', { name: 'Написать рецензию' }).click();
	const body = feed(page).getByRole('textbox', { name: 'Ваша рецензия' });
	await expect(body).toBeInViewport();
	// Оценка из шапки уже выбрана в форме.
	const formRating = feed(page).getByRole('group', { name: 'Оценка от 1 до 10' });
	await expect(formRating.getByRole('button', { name: 'Оценка 8' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await body.fill(text);
	await feed(page).getByRole('button', { name: 'Сохранить' }).click();
	const item = reviewsList(page).getByRole('article').filter({ hasText: text });
	await expect(item).toBeVisible();
	await expect(item.getByLabel('Оценка 8 из 10')).toBeVisible();

	// Правка — кнопкой в ленте; оценку меняем прямо в форме, сохраняется вместе с текстом.
	await feed(page).getByRole('button', { name: 'Изменить рецензию' }).click();
	await body.fill(`${text} (дополнено)`);
	await formRating.getByRole('button', { name: 'Оценка 6' }).click();
	await feed(page).getByRole('button', { name: 'Сохранить' }).click();
	await expect(reviewsList(page)).toContainText(`${text} (дополнено)`);
	await expect(
		reviewsList(page)
			.getByRole('article')
			.filter({ hasText: 'дополнено' })
			.getByLabel('Оценка 6 из 10')
	).toBeVisible();
	await expect(rateToggle(page)).toHaveText(/Ваша\s*6/);

	// В профиле — тоже.
	await page.goto(`/u/${username}/reviews`);
	await expect(page.getByRole('article').filter({ hasText: 'дополнено' })).toContainText('Дюна');

	// Удаление: рецензии и оценки нет, средняя вернулась.
	await page.goto('/films/dune-2021');
	await toFeed(page);
	await feed(page).getByRole('button', { name: 'Изменить рецензию' }).click();
	await feed(page).getByRole('button', { name: 'Удалить', exact: true }).click();
	await feed(page).getByRole('button', { name: 'Удалить', exact: true }).click();
	await expect(feed(page).getByRole('button', { name: 'Написать рецензию' })).toBeVisible();
	await expect(reviewsList(page)).not.toContainText(text);
	await expect(rateToggle(page)).toHaveText(/Оценить/);
	await expect(average(page)).toHaveAttribute('aria-label', counted(before));
});

test('отметки «Посмотреть позже» и «Просмотрено»: гостю — вход, вошедшему — переключатели', async ({
	page,
	request
}) => {
	await page.goto('/films/dune-2021');
	const marks = hero(page).getByRole('group', { name: 'Мои отметки' });
	await expect(marks.getByRole('link', { name: 'Посмотреть позже' })).toHaveAttribute(
		'href',
		'/auth/login?next=%2Ffilms%2Fdune-2021'
	);

	await registerAndSignIn(page, request, 'mrk');
	await page.goto('/films/dune-2021');
	const later = marks.getByRole('button', { name: 'Посмотреть позже' });
	const done = marks.getByRole('button', { name: 'Просмотрено' });
	await later.click();
	await expect(later).toHaveAttribute('aria-pressed', 'true');
	// Взаимоисключающие: просмотрел — из «позже» уходит. Отметка переживает перезагрузку.
	await done.click();
	await expect(done).toHaveAttribute('aria-pressed', 'true');
	await expect(later).toHaveAttribute('aria-pressed', 'false');
	await page.reload();
	await expect(done).toHaveAttribute('aria-pressed', 'true');
});

test('рецензии неизвестного пользователя и произведения — 404', async ({ request }) => {
	expect((await request.get('/u/no-such-user-e2e/reviews')).status()).toBe(404);
	expect((await request.get('/films/no-such-entity/reviews')).status()).toBe(404);
	const wrong = await request.get('/books/dune-2021/reviews', { maxRedirects: 0 });
	expect(wrong.status()).toBe(301);
	expect(wrong.headers()['location']).toBe('/films/dune-2021/reviews');
});
