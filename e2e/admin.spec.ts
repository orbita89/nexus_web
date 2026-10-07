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

test('произведения: создать фильм с полями, трейлером, тегом и участником; правка; удаление', async () => {
	const id = stamp();
	await admin.goto('/admin/entities');
	await admin.getByText('Добавить', { exact: true }).click();
	await admin.getByRole('link', { name: 'Фильм', exact: true }).click();
	await expect(admin).toHaveURL('/admin/entities/new?kind=movie');

	const form = admin.getByRole('form', { name: 'Произведение' });
	await form.locator('input[name=title]').fill(`E2E Фильм ${id}`);
	await form.locator('input[name=original_title]').fill(`E2E Film ${id}`);
	await form.locator('input[name=release_date]').fill('2025-03-01');
	await expect(form.locator('input[name=slug]')).toHaveValue(`e2e-film-${id}-2025`);
	await form.getByPlaceholder('Длительность, мин').fill('125');
	await form.getByPlaceholder('Страны: US, GB').fill('us, gb');
	await form.getByRole('button', { name: '＋ Трейлер' }).click();
	await form
		.getByLabel('Трейлер 1: id или ссылка')
		.fill('https://rutube.ru/video/0ab1fc1e47f2e9b89e9e59d9db36f2b4/');
	await expect(form.getByLabel('Провайдер трейлера 1')).toHaveValue('rutube');
	await form.getByRole('group', { name: 'Теги' }).getByText('Драма', { exact: true }).click();
	await form.getByRole('button', { name: 'Создать' }).click();

	await expect(admin.getByRole('heading', { name: `E2E Фильм ${id}`, level: 1 })).toBeVisible();
	const slug = `e2e-film-${id}-2025`;
	await expect(admin).toHaveURL(`/admin/entities/${slug}`);

	// Участник: режиссёр из каталога.
	const add = admin.getByRole('form', { name: 'Добавить участника' });
	await add.getByPlaceholder('Найти человека').fill('Вильн');
	await admin
		.getByRole('list', { name: 'Найденные люди' })
		.getByRole('button', { name: /Дени Вильнёв/ })
		.click();
	await add.getByLabel('Роль').selectOption('director');
	await add.getByRole('button', { name: 'Добавить участника' }).click();
	await expect(admin.getByRole('list', { name: 'Участники' })).toContainText(
		'Дени Вильнёв · Режиссёр'
	);

	// На сайте — всё, что ввели (SSR).
	let html = await (await admin.request.get(`/films/${slug}`)).text();
	for (const text of [
		`E2E Фильм ${id}`,
		'2 ч 5 мин',
		'США, Великобритания',
		'Драма',
		'Дени Вильнёв',
		'Трейлер'
	]) {
		expect(html).toContain(text);
	}

	// Правка названия.
	await form.locator('input[name=title]').fill(`E2E Фильм ${id} (правка)`);
	await form.getByRole('button', { name: 'Сохранить' }).click();
	await expect(admin.getByText('Сохранено.')).toBeVisible();
	html = await (await admin.request.get(`/films/${slug}`)).text();
	expect(html).toContain(`E2E Фильм ${id} (правка)`);

	await admin.getByRole('button', { name: 'Удалить произведение' }).click();
	await admin.getByRole('button', { name: 'Удалить', exact: true }).click();
	await expect(admin).toHaveURL('/admin/entities');
	expect((await admin.request.get(`/films/${slug}`)).status()).toBe(404);
});

test('модерация: чужие рецензия, сообщение, коллекция, тема; закрыть и открыть тему', async () => {
	const token = async (login: string) =>
		(
			await (
				await admin.request.post('/api/v1/auth/login', { data: { login, password: 'password123' } })
			).json()
		).access_token as string;
	const user = { authorization: `Bearer ${await token('user')}` };
	const author = { authorization: `Bearer ${await token('author')}` };
	const id = stamp();
	const moderate = (scope: Page | ReturnType<Page['locator']>, label: RegExp | string) =>
		scope.getByRole('button', { name: label });

	// Рецензия user на «Прибытие» — админ удаляет на карточке.
	await admin.request.put('/api/v1/social/entities/arrival-2016/review', {
		headers: user,
		data: { rating: 3, body: `E2E модерация ${id}` }
	});
	await admin.goto('/films/arrival-2016');
	const review = admin
		.getByRole('list', { name: 'Рецензии' })
		.getByRole('article')
		.filter({ hasText: `E2E модерация ${id}` });
	await moderate(review, '🛡 Удалить рецензию').click();
	await review.getByRole('button', { name: 'Да' }).click();
	await expect(admin.getByText(`E2E модерация ${id}`)).toHaveCount(0);

	// Тема author — закрыть, ответить (админ может), удалить сообщение user, удалить тему.
	const created = await admin.request.post('/api/v1/social/threads', {
		headers: author,
		data: { title: `E2E тема ${id}`, body: 'Для модерации.', entities: ['arrival-2016'] }
	});
	const threadId = (await created.json()).id as string;
	await admin.request.post(`/api/v1/social/threads/${threadId}/posts`, {
		headers: user,
		data: { body: `E2E сообщение ${id}` }
	});
	await admin.goto(`/forum/${threadId}`);
	await moderate(admin, '🛡 Закрыть тему').click();
	await expect(admin.getByRole('heading', { level: 1 })).toContainText('закрыта');
	await expect(admin.getByLabel('Ваш ответ в теме')).toBeVisible();
	await moderate(admin, '🛡 Открыть тему').click();
	await expect(admin.getByRole('heading', { level: 1 })).not.toContainText('закрыта');

	const post = admin
		.getByRole('list', { name: 'Сообщения' })
		.getByRole('article')
		.filter({ hasText: `E2E сообщение ${id}` });
	await moderate(post, '🛡 Удалить').click();
	await post.getByRole('button', { name: 'Да' }).click();
	await expect(admin.getByText(`E2E сообщение ${id}`)).toHaveCount(0);

	await moderate(admin, '🛡 Удалить тему').click();
	await admin.getByRole('button', { name: 'Да' }).click();
	await expect(admin).toHaveURL('/forum');
	expect((await admin.request.get(`/forum/${threadId}`)).status()).toBe(404);

	// Коллекция user — удалить.
	const collection = await admin.request.post('/api/v1/social/collections', {
		headers: user,
		data: { title: `E2E коллекция ${id}` }
	});
	const collectionId = (await collection.json()).id as string;
	await admin.goto(`/collections/${collectionId}`);
	await moderate(admin, '🛡 Удалить коллекцию').click();
	await admin.getByRole('button', { name: 'Да' }).click();
	await expect(admin).toHaveURL('/collections');
	expect((await admin.request.get(`/api/v1/social/collections/${collectionId}`)).status()).toBe(
		404
	);
});
