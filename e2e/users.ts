// Свежий пользователь для сценария: регистрация → письмо → подтверждение (сразу вход).
// Лимиты входа: не больше одного такого входа на сценарий, никаких циклов.
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { linkFromMail, uniqueEmail } from './mail';

export const PASSWORD = 'e2e-password-123';

export async function registerAndSignIn(
	page: Page,
	request: APIRequestContext,
	prefix = 'e2e'
): Promise<{ email: string; username: string }> {
	const email = uniqueEmail(prefix);
	const username = `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	await page.goto('/auth/register');
	await page.locator('input[name=email]').fill(email);
	await page.locator('input[name=username]').fill(username);
	await page.locator('input[name=password]').fill(PASSWORD);
	await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
	await expect(page.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible();
	await page.goto(await linkFromMail(request, email, '/auth/verify-email'));
	await expect(page.getByRole('button', { name: 'Меню пользователя' })).toBeVisible();
	return { email, username };
}
