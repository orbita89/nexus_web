import { expect, test, type Page } from '@playwright/test';
import { registerAndSignIn } from './users';

// Профили и подписки. Данные — из make seed: author (темы, рецензии), на него подписаны user
// и admin; blocked заблокирован — его профиля нет.

const tabs = (page: Page) => page.getByRole('navigation', { name: 'Разделы профиля' });

test('гость: шапка, вкладки, темы и подписчики', async ({ page, request }) => {
	const profile = await (await request.get('/api/v1/social/users/author')).json();

	await page.goto('/u/author');
	await expect(page.getByRole('heading', { name: 'Автор форума', level: 1 })).toBeVisible();
	await expect(page.getByText('@author', { exact: true })).toBeVisible();
	await expect(
		tabs(page).getByRole('link', { name: `Темы ${profile.threads_count}` })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Подписаться' })).toHaveAttribute(
		'href',
		'/auth/login?next=%2Fu%2Fauthor'
	);

	await tabs(page).getByRole('link', { name: /^Темы/ }).click();
	await expect(page).toHaveURL('/u/author/threads');
	await expect(page.getByRole('list', { name: 'Темы', exact: true })).toContainText(
		'Дюна: книга против экранизаций'
	);

	await tabs(page)
		.getByRole('link', { name: /^Подписчики/ })
		.click();
	await expect(page).toHaveURL('/u/author/followers');
	await page
		.getByRole('list', { name: 'Подписчики' })
		.getByRole('link', { name: /Обычный пользователь/ })
		.click();
	await expect(page).toHaveURL('/u/user');
	await expect(page.getByRole('heading', { name: 'Обычный пользователь', level: 1 })).toBeVisible();
});

test('неизвестный и заблокированный пользователь — 404', async ({ request }) => {
	expect((await request.get('/u/no-such-user-e2e')).status()).toBe(404);
	expect((await request.get('/u/blocked')).status()).toBe(404);
	expect((await request.get('/u/no-such-user-e2e/followers')).status()).toBe(404);
});

test('вошедший: подписка и отписка, счётчик, своё имя в подписчиках; свой профиль', async ({
	page,
	request
}) => {
	const { username } = await registerAndSignIn(page, request, 'fol');
	const before = (await (await request.get('/api/v1/social/users/author')).json())
		.followers_count as number;
	const followers = (n: number) => tabs(page).getByRole('link', { name: `Подписчики ${n}` });

	await page.goto('/u/author');
	await expect(followers(before)).toBeVisible();
	await page.getByRole('button', { name: 'Подписаться', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Вы подписаны' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(followers(before + 1)).toBeVisible();

	// После перезагрузки подписка видна: профиль перечитывается с токеном.
	await page.reload();
	await expect(page.getByRole('button', { name: 'Вы подписаны' })).toBeVisible();
	await tabs(page)
		.getByRole('link', { name: /^Подписчики/ })
		.click();
	await expect(page.getByRole('list', { name: 'Подписчики' })).toContainText(`@${username}`);

	await page.getByRole('button', { name: 'Вы подписаны' }).click();
	await expect(page.getByRole('button', { name: 'Подписаться', exact: true })).toBeVisible();
	await expect(followers(before)).toBeVisible();

	// Свой профиль: вместо подписки — редактирование.
	await page.goto(`/u/${username}`);
	await expect(page.getByRole('link', { name: 'Редактировать профиль' })).toHaveAttribute(
		'href',
		'/settings'
	);
	await expect(page.getByRole('button', { name: 'Подписаться' })).toHaveCount(0);
});
