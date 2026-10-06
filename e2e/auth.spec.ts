import { expect, test, type Page } from '@playwright/test';
import { linkFromMail, uniqueEmail } from './mail';

// Лимиты входа: 10 попыток на аккаунт, 30 запросов входа и писем в минуту с IP.
// Поэтому в каждом сценарии не больше одного входа по паролю и никаких циклов.

const PASSWORD = 'e2e-password-123';

const userMenu = (page: Page) => page.getByRole('button', { name: 'Меню пользователя' });

async function logout(page: Page) {
	await userMenu(page).click();
	await page.getByRole('button', { name: 'Выйти', exact: true }).click();
	await expect(
		page
			.getByRole('navigation', { name: 'Основная навигация' })
			.getByRole('link', { name: 'Войти', exact: true })
	).toBeVisible();
}

async function login(page: Page, loginName: string, password: string) {
	await page.locator('input[name=login]').fill(loginName);
	await page.locator('input[name=password]').fill(password);
	await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

test('регистрация → письмо → подтверждение → вход → выход', async ({ page, request }) => {
	const email = uniqueEmail('reg');
	const username = `e2e_${Date.now().toString(36)}`;

	await page.goto('/auth/register');
	await page.locator('input[name=email]').fill(email);
	await page.locator('input[name=username]').fill(username);
	await page.locator('input[name=password]').fill(PASSWORD);
	await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
	await expect(page.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible();

	await page.goto(await linkFromMail(request, email, '/auth/verify-email'));
	await expect(page.getByText('Email подтверждён, вы вошли.')).toBeVisible();
	await expect(userMenu(page)).toBeVisible();

	await logout(page);

	await page.goto('/auth/login');
	await login(page, username, PASSWORD);
	await expect(page).toHaveURL('/');
	await expect(userMenu(page)).toBeVisible();

	// Перезагрузка: access-токен в памяти пропал, сессия восстанавливается по refresh.
	await page.reload();
	await expect(userMenu(page)).toBeVisible();

	await logout(page);
	await page.reload();
	await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
});

test('вход по ссылке из письма', async ({ page, request }) => {
	const email = uniqueEmail('link');

	await page.goto('/auth/email-login');
	await page.locator('input[name=email]').fill(email);
	await page.getByRole('button', { name: 'Прислать ссылку' }).click();
	await expect(page.getByText('Мы отправили ссылку для входа')).toBeVisible();

	await page.goto(await linkFromMail(request, email, '/auth/email-login'));
	await expect(page).toHaveURL('/');
	await expect(userMenu(page)).toBeVisible();
});

test('сброс пароля', async ({ page, request }) => {
	const email = uniqueEmail('reset');
	const username = `e2e_r_${Date.now().toString(36)}`;
	const register = await request.post('/api/v1/auth/register', {
		data: { email, username, password: PASSWORD }
	});
	expect(register.status()).toBe(201);

	await page.goto('/auth/forgot-password');
	await page.locator('input[name=email]').fill(email);
	await page.getByRole('button', { name: 'Прислать ссылку' }).click();
	await expect(page.getByText('ссылку для сброса пароля')).toBeVisible();

	await page.goto(await linkFromMail(request, email, '/auth/reset-password'));
	await page.locator('input[name=password]').fill('new-e2e-password-456');
	await page.locator('input[name=repeat]').fill('new-e2e-password-456');
	await page.getByRole('button', { name: 'Сохранить пароль' }).click();
	await expect(page.getByText('Пароль изменён.')).toBeVisible();

	// Сброс подтверждает email: теперь можно войти новым паролем.
	await page.getByRole('link', { name: 'Войти' }).last().click();
	await login(page, email, 'new-e2e-password-456');
	await expect(page).toHaveURL('/');
	await expect(userMenu(page)).toBeVisible();
});

test('закрытая страница → вход → возврат на неё; список сессий', async ({ page }) => {
	await page.goto('/settings/security');
	await expect(page).toHaveURL('/auth/login?next=%2Fsettings%2Fsecurity');

	await login(page, 'user', 'password123');
	await expect(page).toHaveURL('/settings/security');
	await expect(page.getByText('это устройство')).toBeVisible();

	await logout(page);
});

test('недействительная ссылка из письма — понятная ошибка', async ({ page }) => {
	await page.goto('/auth/verify-email?token=broken');
	await expect(page.getByRole('alert')).toContainText('Ссылка недействительна или устарела');
});

test('без провайдеров страница входа работает', async ({ page }) => {
	await page.goto('/auth/login');
	await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: /Войти через/ })).toHaveCount(0);
});
