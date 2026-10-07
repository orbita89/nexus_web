import { expect, test, type Page } from '@playwright/test';
import { registerAndSignIn } from './users';

// Админка. Вход под admin — один на файл: тесты последовательные и делят страницу (лимит входов
// на аккаунт). Всё, что тесты создают, они же и удаляют; сидовые данные возвращаются как были.
test.describe.configure({ mode: 'serial' });

let admin: Page;

test.beforeAll(async ({ browser }) => {
	admin = await browser.newPage();
	await admin.route(
		/^https:\/\/(www\.youtube-nocookie\.com|rutube\.ru|image\.tmdb\.org|covers\.openlibrary\.org|steamcdn-a\.akamaihd\.net)\//,
		(r) => r.abort()
	);
	await admin.goto('/auth/login?next=%2Fadmin');
	await admin.locator('input[name=login]').fill('admin');
	await admin.locator('input[name=password]').fill('password123');
	await admin.getByRole('button', { name: 'Войти', exact: true }).click();
	await expect(admin).toHaveURL('/admin');
});

test.afterAll(async () => admin?.close());

const stamp = () => Date.now().toString(36);

test('не админ: нет доступа и нет ссылки в меню', async ({ page, request }) => {
	await registerAndSignIn(page, request, 'adm');
	await page.getByRole('button', { name: 'Меню пользователя' }).click();
	await expect(page.getByRole('link', { name: 'Админка' })).toHaveCount(0);
	await page.goto('/admin');
	await expect(page.getByText('Нет доступа')).toBeVisible();
});

test('пользователи: роль и блокировка, себя не изменить', async () => {
	await admin
		.getByRole('navigation', { name: 'Разделы админки' })
		.getByRole('link', { name: 'Пользователи' })
		.click();
	await expect(admin).toHaveURL('/admin/users');
	await expect(admin.getByLabel('Роль @admin')).toBeDisabled();

	const role = admin.getByLabel('Роль @blocked');
	await role.selectOption('author');
	await expect(role).toHaveValue('author');
	await role.selectOption('user');
	await expect(role).toHaveValue('user');

	await admin.getByRole('button', { name: 'Разблокировать @blocked' }).click();
	await admin.getByRole('button', { name: 'Заблокировать @blocked' }).click();
	await expect(admin.getByRole('button', { name: 'Разблокировать @blocked' })).toBeVisible();
});

test('теги: создать (slug из названия), переименовать, удалить', async () => {
	await admin.goto('/admin/tags');
	const name = `E2E тег ${stamp()}`;
	const form = admin.getByRole('form', { name: 'Новый тег' });
	await form.getByPlaceholder('Название').fill(name);
	await expect(form.getByPlaceholder('slug')).toHaveValue(/^e2e-teg-/);
	await form.getByRole('button', { name: 'Добавить тег' }).click();
	const row = admin.getByRole('row').filter({ hasText: name });
	await expect(row).toContainText('0');

	await row.getByRole('button', { name: `Изменить тег ${name}` }).click();
	await admin.getByLabel('Название', { exact: true }).last().fill(`${name} (новое)`);
	await admin.getByRole('button', { name: 'Сохранить' }).click();
	const renamed = admin.getByRole('row').filter({ hasText: `${name} (новое)` });
	await expect(renamed).toBeVisible();

	await renamed.getByRole('button', { name: /^Удалить тег/ }).click();
	await renamed.getByRole('button', { name: 'Удалить', exact: true }).click();
	await expect(admin.getByRole('row').filter({ hasText: name })).toHaveCount(0);
});

test('люди: добавить, изменить, на сайте, удалить', async () => {
	await admin.goto('/admin/people');
	await admin.getByRole('link', { name: 'Добавить человека' }).click();
	const name = `E2E Персона ${stamp()}`;
	await admin.locator('input[name=full_name]').fill(name);
	await expect(admin.locator('input[name=slug]')).toHaveValue(/^e2e-persona-/);
	await admin.locator('textarea[name=bio]').fill('Создан тестом.');
	await admin.getByRole('button', { name: 'Добавить' }).click();
	await expect(admin.getByRole('heading', { name, level: 1 })).toBeVisible();
	const slug = await admin.locator('input[name=slug]').inputValue();

	await admin.locator('textarea[name=bio]').fill('Изменён тестом.');
	await admin.getByRole('button', { name: 'Сохранить' }).click();
	await expect(admin.getByText('Сохранено.')).toBeVisible();

	const site = await admin.request.get(`/people/${slug}`);
	expect(await site.text()).toContain('Изменён тестом.');

	await admin.getByRole('button', { name: 'Удалить человека' }).click();
	await admin.getByRole('button', { name: 'Удалить', exact: true }).click();
	await expect(admin).toHaveURL('/admin/people');
	expect((await admin.request.get(`/people/${slug}`)).status()).toBe(404);
});
