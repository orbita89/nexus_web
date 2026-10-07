import { expect, test, type Page } from '@playwright/test';
import { registerAndSignIn } from './users';

// Коллекции. Данные — из make seed: у user публичная «Дюна во всех видах» и личная «Посмотреть
// позже»; у author — «Зона: Стругацкие и наследники».
const DUNE_COLLECTION = '/collections/00000000-0000-4000-9000-000000000001';
const PRIVATE_COLLECTION = '/collections/00000000-0000-4000-9000-000000000002';

test.beforeEach(async ({ page }) => {
	await page.route(
		/^https:\/\/(www\.youtube-nocookie\.com|rutube\.ru|image\.tmdb\.org|covers\.openlibrary\.org|steamcdn-a\.akamaihd\.net)\//,
		(r) => r.abort()
	);
});

const userMenu = (page: Page) => page.getByRole('button', { name: 'Меню пользователя' });
const contents = (page: Page) => page.getByRole('list', { name: 'Содержимое коллекции' });

test('гость: список, коллекция с заметками, «В коллекциях» на карточке, личная — 404', async ({
	page
}) => {
	await page.goto('/collections');
	await page.getByRole('link', { name: 'Дюна во всех видах' }).click();
	await expect(page).toHaveURL(DUNE_COLLECTION);
	await expect(page.getByRole('heading', { name: 'Дюна во всех видах', level: 1 })).toBeVisible();
	await expect(page.getByText('С чего всё началось')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Изменить содержимое' })).toHaveCount(0);

	await page.goto('/films/dune-2021');
	await expect(page.getByRole('list', { name: 'В коллекциях' })).toContainText(
		'Дюна во всех видах'
	);
	await expect(page.getByRole('link', { name: '＋ В коллекцию' })).toHaveAttribute(
		'href',
		'/auth/login?next=%2Ffilms%2Fdune-2021'
	);

	await page.goto('/u/user/collections');
	await expect(page.getByRole('list', { name: 'Коллекции' })).toContainText('Дюна во всех видах');
	await expect(page.getByRole('list', { name: 'Коллекции' })).not.toContainText('Посмотреть позже');

	await page.goto(PRIVATE_COLLECTION);
	await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible();
});

test('пользователь: коллекция с карточки, содержимое, порядок, заметка, личная, удаление', async ({
	page,
	request,
	browser
}) => {
	const { username } = await registerAndSignIn(page, request, 'col');
	const title = `E2E: Пустыня ${Date.now()}`;

	// С карточки: новой коллекции ещё нет — создаём и сразу добавляем «Дюну».
	await page.goto('/films/dune-2021');
	await expect(userMenu(page)).toBeVisible();
	await page.getByRole('button', { name: '＋ В коллекцию' }).click();
	const dialog = page.getByRole('dialog', { name: 'Добавить в коллекцию: Дюна' });
	await expect(dialog).toContainText('Коллекций пока нет');
	await dialog.getByRole('button', { name: '＋ Новая коллекция' }).click();
	await dialog.getByPlaceholder('Название').fill(title);
	await dialog.getByRole('button', { name: 'Создать и добавить' }).click();
	await expect(dialog.getByRole('checkbox', { name: new RegExp(title) })).toBeChecked();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('list', { name: 'В коллекциях' })).toContainText(title);

	// В профиле — новая коллекция; открываем и добавляем книгу поиском.
	await page.goto(`/u/${username}/collections`);
	await expect(userMenu(page)).toBeVisible();
	await page.getByRole('link', { name: title }).click();
	await page.getByRole('button', { name: 'Изменить содержимое' }).click();
	await page.getByRole('searchbox', { name: 'Найти произведение' }).fill('пикник');
	await page
		.getByRole('list', { name: 'Найденные произведения' })
		.getByRole('button', { name: /^Пикник на обочине/ })
		.click();
	await expect(contents(page).getByRole('listitem')).toHaveCount(2);

	// Порядок: книга наверх — стрелкой, и это сохраняется.
	await page.getByRole('button', { name: 'Выше: Пикник на обочине' }).click();
	await expect(contents(page).getByRole('listitem').first()).toContainText('Пикник на обочине');
	await page.reload();
	await expect(userMenu(page)).toBeVisible();
	await page.getByRole('button', { name: 'Изменить содержимое' }).click();
	await expect(contents(page).getByRole('listitem').first()).toContainText('Пикник на обочине');

	// Перетаскивание возвращает «Дюну» наверх.
	await contents(page)
		.getByRole('listitem')
		.nth(1)
		.dragTo(contents(page).getByRole('listitem').first());
	await expect(contents(page).getByRole('listitem').first()).toContainText('Дюна');

	// Заметка видна в обычном режиме подписью под постером.
	const picnic = contents(page).getByRole('listitem').filter({ hasText: 'Пикник на обочине' });
	await picnic.getByRole('button', { name: 'Добавить заметку' }).click();
	await picnic.getByLabel('Заметка').fill('Первоисточник «Сталкера»');
	await picnic.getByRole('button', { name: 'Сохранить' }).click();
	await expect(picnic).toContainText('Первоисточник «Сталкера»');
	await page.getByRole('button', { name: 'Готово' }).click();
	await expect(page.getByText('Первоисточник «Сталкера»')).toBeVisible();

	// Личная: гость её не видит.
	await page.getByRole('button', { name: 'Название и описание' }).click();
	await page.getByRole('checkbox', { name: 'Видна всем' }).uncheck();
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await expect(page.getByText('🔒 личная')).toBeVisible();
	const guest = await browser.newPage();
	await guest.goto(page.url());
	await expect(guest.getByRole('heading', { name: '404', level: 1 })).toBeVisible();
	await guest.close();

	// Удаление — обратно в профиль, коллекции нет.
	await page.getByRole('button', { name: 'Удалить коллекцию' }).click();
	await page.getByRole('button', { name: 'Удалить', exact: true }).click();
	await expect(page).toHaveURL(`/u/${username}/collections`);
	await expect(page.getByText(title)).toHaveCount(0);
});
