import { expect, test } from '@playwright/test';
import { registerAndSignIn } from './users';

// Чат: каталог комнат → комната в панели → сообщение → профиль автора.
// Один вход на файл (лимит входов на аккаунт), поэтому всё одним сценарием.
test('комната: сообщение и переход в профиль автора', async ({ page, request }) => {
	const { username } = await registerAndSignIn(page, request, 'chat');

	await page.goto('/chat');
	const room = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('heading') })
		.first();
	// Комната открывается поверх вкладки — с кнопкой «Назад».
	test.skip((await room.count()) === 0, 'В базе нет ни одной комнаты');
	const title = await room.getByRole('heading').innerText();
	await room.getByRole('button', { name: 'Открыть' }).click();

	const panel = page.getByRole('complementary', { name: 'Чат' });
	await expect(panel.getByRole('link', { name: title }).or(panel.getByText(title))).toBeVisible();

	const body = `e2e ${Date.now().toString(36)}`;
	await panel.getByLabel('Сообщение').fill(body);
	await panel.getByRole('button', { name: 'Отправить' }).click();
	const sent = panel.getByText(body, { exact: true });
	await expect(sent).toBeVisible();

	// Имя автора — ссылка на его профиль; панель при переходе остаётся открытой.
	await panel.getByRole('link', { name: username }).first().click();
	await expect(page).toHaveURL(`/u/${username}`);
	await expect(panel.getByLabel('Сообщение')).toBeVisible();
});

test('панель: вкладка — это сам чат, а не список чатов', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Чат', exact: true }).first().click();
	const panel = page.getByRole('complementary', { name: 'Чат' });

	// «Общий» открывает ленту сразу: есть поле ввода (или приглашение войти), выбирать нечего.
	await panel.getByRole('tab', { name: 'Общий' }).click();
	await expect(panel.getByText('Войдите').or(panel.getByLabel('Сообщение'))).toBeVisible();

	// «Каталог» — чипы разделов, каждый тоже сразу лента.
	await panel.getByRole('tab', { name: 'Каталог' }).click();
	const chips = panel.getByRole('group', { name: 'Раздел каталога' });
	await expect(chips.getByRole('button', { name: 'Кино' })).toBeVisible();
	await chips.getByRole('button', { name: 'Книги' }).click();
	await expect(panel.getByText('Войдите').or(panel.getByLabel('Сообщение'))).toBeVisible();

	// Список один — «Мои чаты»: и чаты интересов, и комнаты вперемешку.
	await panel.getByRole('tab', { name: 'Мои чаты' }).click();
	await expect(panel.getByLabel('Найти чат')).toBeVisible();
	await expect(panel.getByRole('link', { name: 'Каталог комнат' }).last()).toBeVisible();
});
