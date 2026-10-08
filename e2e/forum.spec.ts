import { expect, test, type Page } from '@playwright/test';
import { registerAndSignIn } from './users';

// Форум. Данные — из make seed: тема «Дюна: книга против экранизаций» (author, ветки ответов,
// удалённое сообщение), закрытая тема про «Ведьмака» (admin). Видео и картинки не нужны.
const DUNE_THREAD = '/forum/00000000-0000-4000-9100-000000000001';
const LOCKED_THREAD = '/forum/00000000-0000-4000-9100-000000000003';

test.beforeEach(async ({ page }) => {
	await page.route(
		/^https:\/\/(www\.youtube-nocookie\.com|rutube\.ru|image\.tmdb\.org|covers\.openlibrary\.org|steamcdn-a\.akamaihd\.net)\//,
		(r) => r.abort()
	);
});

const posts = (page: Page) => page.getByRole('list', { name: 'Сообщения' });
const userMenu = (page: Page) => page.getByRole('button', { name: 'Меню пользователя' });

/** Полная загрузка страницы и ожидание, пока сессия восстановится по refresh. Уйти раньше —
 * оборвать refresh в пути: сервер токен заменил, а новый не сохранился, и следующий refresh
 * старым токеном бэкенд примет за кражу (docs/backend-questions.md, «Окно повтора»). */
async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(userMenu(page)).toBeVisible();
}

/** Сообщение по id: после «Изменить» текст уходит в textarea и фильтр по тексту его теряет. */
async function byId(page: Page, text: string) {
	const id = await post(page, text).getAttribute('id');
	return page.locator(`[id="${id}"]`);
}
const post = (page: Page, text: string) =>
	posts(page).getByRole('article').filter({ hasText: text });

test('гость: список тем, тема с ветками, закрытая тема', async ({ page }) => {
	await page.goto('/forum');
	await page.getByRole('link', { name: 'Дюна: книга против экранизаций' }).click();
	await expect(page).toHaveURL(DUNE_THREAD);
	await expect(
		page.getByRole('heading', { name: 'Дюна: книга против экранизаций', level: 1 })
	).toBeVisible();
	await expect(
		page.getByRole('region', { name: 'Произведения темы' }).getByRole('link')
	).toHaveCount(4);
	await expect(posts(page)).toContainText('в ответ @user');
	await expect(posts(page)).toContainText('Сообщение удалено');
	await expect(page.getByRole('link', { name: 'Войдите' })).toHaveAttribute(
		'href',
		`/auth/login?next=${encodeURIComponent(DUNE_THREAD)}`
	);
	await expect(page.getByRole('button', { name: 'Ответить' })).toHaveCount(0);

	await page.goto(LOCKED_THREAD);
	await expect(page.getByText('Тема закрыта для ответов.')).toBeVisible();

	expect((await page.request.get('/forum/00000000-0000-4000-9100-00000000dead')).status()).toBe(
		404
	);
});

test('пользователь: ответ в тему, ответ на сообщение, правка, удаление', async ({
	page,
	request
}) => {
	const { username } = await registerAndSignIn(page, request, 'frm');

	// Обычный пользователь темы не создаёт.
	await open(page, '/forum');
	await expect(page.getByText('Темы создают авторы')).toBeVisible();

	await open(page, DUNE_THREAD);
	const first = `E2E: первый ответ ${Date.now()}`;
	await page.getByLabel('Ваш ответ в теме').fill(first);
	await page.getByRole('button', { name: 'Отправить' }).click();
	await expect(page).toHaveURL(/#post-[\w-]+$/);
	await expect(post(page, first)).toBeVisible();

	// Ответ на своё сообщение: цитата с автором и началом текста.
	await post(page, first).getByRole('button', { name: 'Ответить' }).click();
	const reply = `E2E: ответ на ответ ${Date.now()}`;
	await page.getByLabel('Ваш ответ на сообщение').fill(reply);
	await page.getByLabel('Ваш ответ на сообщение').press('Tab');
	await post(page, first).getByRole('button', { name: 'Отправить' }).click();
	await expect(post(page, reply)).toContainText(`в ответ @${username}: «${first}»`);

	// Правка.
	const edited = await byId(page, reply);
	await edited.getByRole('button', { name: 'Изменить' }).click();
	await edited.getByLabel('Текст сообщения').fill(`${reply} (исправлено)`);
	await edited.getByRole('button', { name: 'Сохранить' }).click();
	await expect(post(page, `${reply} (исправлено)`)).toContainText('изменено');

	// Удаление: сначала ответ, потом исходное — оба пропадают без заглушек.
	for (const text of [reply, first]) {
		const item = await byId(page, text);
		await item.getByRole('button', { name: 'Удалить' }).click();
		await item.getByRole('button', { name: 'Удалить' }).click();
		await expect(post(page, text)).toHaveCount(0);
	}
});

test('автор: тема с карточки на два произведения, правка, удаление', async ({ page }) => {
	await page.goto('/auth/login?next=%2Ffilms%2Fdune-2021');
	await page.locator('input[name=login]').fill('author');
	await page.locator('input[name=password]').fill('password123');
	await page.getByRole('button', { name: 'Войти', exact: true }).click();
	await expect(page).toHaveURL('/films/dune-2021');

	await page.getByRole('link', { name: 'Начать обсуждение' }).click();
	await expect(page).toHaveURL('/forum/new?entity=dune-2021');
	const picked = page.getByRole('list', { name: 'Выбранные произведения' });
	await expect(picked).toContainText('Дюна · 2021 · Фильм');

	const title = `E2E: фильм и роман ${Date.now()}`;
	await page.locator('input[name=title]').fill(title);
	await page.getByRole('searchbox', { name: 'Найти произведение' }).fill('дюна');
	await page
		.getByRole('list', { name: 'Найденные произведения' })
		.getByRole('button', { name: 'Дюна · 1965 · Книга' })
		.click();
	await expect(picked.getByRole('listitem')).toHaveCount(2);
	await page
		.locator('textarea[name=body]')
		.fill('Сравниваем роман и фильм: что потеряли, что нашли.');
	await page.getByRole('button', { name: 'Создать тему' }).click();

	await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
	const entities = page.getByRole('region', { name: 'Произведения темы' });
	await expect(entities.getByRole('link')).toHaveCount(2);
	await expect(entities.getByRole('link').first()).toHaveAttribute('href', '/films/dune-2021');
	const threadUrl = page.url();

	// Тема видна в обсуждениях книги — она привязана к обоим произведениям. (На карточке
	// обсуждения вернутся клиентским блоком; пока — страница «Все обсуждения».)
	await open(page, '/books/dune-novel/threads');
	await expect(page.getByRole('list', { name: 'Обсуждения' })).toContainText(title);

	await open(page, threadUrl);
	await page.getByRole('link', { name: 'Изменить тему' }).click();
	await page.locator('input[name=title]').fill(`${title} (правка)`);
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await expect(page.getByRole('heading', { name: `${title} (правка)`, level: 1 })).toBeVisible();
	await expect(page.getByText('· изменено').first()).toBeVisible();

	await page.getByRole('button', { name: 'Удалить тему' }).click();
	await page.getByRole('button', { name: 'Удалить', exact: true }).click();
	await expect(page).toHaveURL('/forum');
	await expect(page.getByRole('list', { name: 'Темы', exact: true })).not.toContainText(title);
});
