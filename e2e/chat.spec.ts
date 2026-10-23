import { expect, test, type Page } from '@playwright/test';
import { registerAndSignIn } from './users';

// Чат. На десктопе панель закреплена справа и видна всегда — открывать её не нужно
// (кнопка «Чат» в шапке там, наоборот, сворачивает панель).
const panelOf = (page: Page) => page.getByRole('complementary', { name: 'Чат' });

test('вкладка — это сам чат, а не список чатов', async ({ page }) => {
	await page.goto('/');
	const panel = panelOf(page);

	// «Общий» открывает ленту сразу: гостю — приглашение войти, выбирать нечего.
	await panel.getByRole('tab', { name: 'Общий' }).click();
	await expect(panel.getByText('Войдите', { exact: false })).toBeVisible();

	// «Каталог» — чипы разделов, каждый чип тоже сразу лента.
	await panel.getByRole('tab', { name: 'Каталог' }).click();
	const chips = panel.getByRole('group', { name: 'Раздел каталога' });
	await expect(chips.getByRole('button', { name: 'Кино' })).toBeVisible();
	await chips.getByRole('button', { name: 'Книги' }).click();
	await expect(panel.getByText('Войдите', { exact: false })).toBeVisible();

	// Списки — только во вкладке «Чаты», с переключателем.
	await panel.getByRole('tab', { name: 'Чаты' }).click();
	await expect(panel.getByLabel('Найти чат')).toBeVisible();
	await panel.getByRole('button', { name: 'Обсуждается' }).click();
	await expect(panel.getByLabel('Найти комнату')).toBeVisible();
	await panel.getByRole('button', { name: 'Мои чаты' }).click();
	await expect(panel.getByLabel('Найти чат')).toBeVisible();
	await expect(panel.getByRole('link', { name: 'Каталог комнат' }).last()).toBeVisible();
});

test('системный чат: сообщение и переход в профиль автора', async ({ page, request }) => {
	const { username } = await registerAndSignIn(page, request, 'chat');
	const panel = panelOf(page);

	await panel.getByRole('tab', { name: 'Общий' }).click();
	// В системном чате состоят все: ни шапки, ни «Вступить» — сразу поле ввода.
	const composer = panel.getByLabel('Сообщение');
	await expect(composer).toBeVisible();

	const body = `e2e ${Date.now().toString(36)}`;
	await composer.fill(body);
	await panel.getByRole('button', { name: 'Отправить' }).click();
	await expect(panel.getByText(body, { exact: true })).toBeVisible();

	// Общий чат: можно заглушить и убрать из списка, а вернуть — одной ссылкой.
	await panel.getByRole('tab', { name: 'Чаты' }).click();
	await panel.getByRole('button', { name: 'Заглушить: Общий чат' }).click();
	await expect(panel.getByRole('button', { name: 'Вернуть уведомления: Общий чат' })).toBeVisible();

	await panel.getByRole('button', { name: 'Убрать из списка: Общий чат' }).click();
	await expect(panel.getByRole('button', { name: /^Общий чат/ })).toHaveCount(0);

	// Возвращается тем же правилом, что и любой другой чат: написал — значит он твой.
	await panel.getByRole('tab', { name: 'Общий' }).click();
	await panel.getByLabel('Сообщение').fill(`e2e ${Date.now().toString(36)}`);
	await panel.getByRole('button', { name: 'Отправить' }).click();
	await panel.getByRole('tab', { name: 'Чаты' }).click();
	await expect(panel.getByRole('button', { name: /^Общий чат/ })).toBeVisible();

	await panel.getByRole('tab', { name: 'Общий' }).click();

	// Имя автора — ссылка на профиль; панель при переходе остаётся на месте.
	await panel.getByRole('link', { name: username }).first().click();
	await expect(page).toHaveURL(`/u/${username}`);
	await expect(panel.getByLabel('Сообщение')).toBeVisible();
});

test('слежу за карточкой — её чат появляется в панели и в свёрнутой полосе', async ({
	page,
	request
}) => {
	await registerAndSignIn(page, request, 'watch');
	const panel = panelOf(page);

	await page.goto('/films/dune-2021');
	await page.getByRole('button', { name: 'Открыть чат' }).click();
	await panel.getByRole('button', { name: 'Следить', exact: true }).click();
	await expect(panel.getByRole('button', { name: 'Вы следите' })).toBeVisible();

	// Чат интереса — в списке «Мои чаты», а не только в открытой комнате.
	await panel.getByRole('tab', { name: 'Чаты' }).click();
	await expect(panel.getByRole('button', { name: /^Дюна/ })).toBeVisible();

	// И в свёрнутой полосе — вместе с общими чатами, которые идут первыми.
	await page.getByRole('button', { name: 'Чат', exact: true }).first().click();
	await expect(panel.getByRole('button', { name: 'Общий чат', exact: true })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'Дюна', exact: true })).toBeVisible();
});

test('написал в чужой чат — он сам становится своим', async ({ page, request }) => {
	await registerAndSignIn(page, request, 'write');
	const panel = panelOf(page);

	await page.goto('/people/denis-villeneuve');
	await page.getByRole('button', { name: 'Открыть чат' }).click();
	// «Следить» не нажимаем — достаточно написать.
	await expect(panel.getByRole('button', { name: 'Следить', exact: true })).toBeVisible();
	await panel.getByLabel('Сообщение').fill(`e2e ${Date.now().toString(36)}`);
	await panel.getByRole('button', { name: 'Отправить' }).click();

	await expect(panel.getByRole('button', { name: 'Вы следите' })).toBeVisible();
	await panel.getByRole('tab', { name: 'Чаты' }).click();
	await expect(panel.getByRole('button', { name: /^Дени Вильнёв/ })).toBeVisible();

	// Уведомления можно выключить, не выходя из чата.
	await panel.getByRole('button', { name: /^Заглушить: Дени Вильнёв/ }).click();
	await expect(panel.getByRole('button', { name: /^Вернуть уведомления: Дени/ })).toBeVisible();

	// Крестик в строке убирает чат из своих, не открывая комнату.
	await panel.getByRole('button', { name: /^Не следить: / }).click();
	await expect(panel.getByRole('button', { name: /Вильнёв/ })).toHaveCount(0);
});

test('непрочитанное снимается, когда сообщение прочитали', async ({ browser, request }) => {
	// Нужны двое: свои сообщения непрочитанными не считаются.
	const readerContext = await browser.newContext();
	const reader = await readerContext.newPage();
	const writerContext = await browser.newContext();
	const writer = await writerContext.newPage();
	try {
		await registerAndSignIn(reader, request, 'rdr');
		await registerAndSignIn(writer, request, 'wrt');

		// Читатель смотрит в другую вкладку панели — иначе прочитает сразу.
		const panel = panelOf(reader);
		await panel.getByRole('tab', { name: 'Чаты' }).click();

		const body = `e2e ${Date.now().toString(36)}`;
		const writerPanel = panelOf(writer);
		await writerPanel.getByRole('tab', { name: 'Общий' }).click();
		await writerPanel.getByLabel('Сообщение').fill(body);
		await writerPanel.getByRole('button', { name: 'Отправить' }).click();
		await expect(writerPanel.getByText(body, { exact: true })).toBeVisible();

		// У читателя — значок непрочитанного на вкладке «Общий».
		const generalTab = panel.getByRole('tab', { name: /^Общий/ });
		await expect(generalTab.getByLabel(/^Непрочитанных: /)).toBeVisible();

		// Открыл, прочитал — значок этой вкладки пропал.
		await generalTab.click();
		await expect(panel.getByText(body, { exact: true })).toBeVisible();
		await expect(generalTab.getByLabel(/^Непрочитанных: /)).toHaveCount(0);

		// Остальное непрочитанное (другие общие чаты) снимается одной кнопкой.
		await panel.getByRole('button', { name: 'Прочитать всё' }).click();
		await expect(panel.getByLabel(/^Непрочитанных: /)).toHaveCount(0);
		await expect(panel.getByRole('button', { name: 'Прочитать всё' })).toHaveCount(0);
	} finally {
		await readerContext.close();
		await writerContext.close();
	}
});

test('своя комната: создание, открытие и удаление', async ({ page, request }) => {
	await registerAndSignIn(page, request, 'room');
	const panel = panelOf(page);
	const slug = `e2e-${Date.now().toString(36)}`;

	await page.goto('/chat');
	await page.getByRole('button', { name: 'Создать комнату' }).click();
	const form = page.getByRole('form', { name: 'Новая комната' });
	await form.getByLabel('Название').fill('E2E комната');
	await form.getByLabel('Адрес (slug)').fill(slug);
	await form.getByLabel('Описание', { exact: false }).fill('Создана тестом');
	await form.getByRole('button', { name: 'Создать' }).click();

	// После создания комната открывается в панели, и автор уже внутри.
	await expect(panel.getByLabel('Сообщение')).toBeVisible();
	await expect(panel.getByRole('link', { name: 'E2E комната' })).toBeVisible();

	// В каталоге она своя: есть «Изменить» и «Удалить», а не «Пожаловаться».
	const card = page.getByRole('listitem').filter({ hasText: 'E2E комната' });
	await expect(card.getByRole('button', { name: 'Изменить' })).toBeVisible();
	await card.getByRole('button', { name: 'Удалить', exact: true }).click();
	await card.getByRole('button', { name: 'Удалить навсегда' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: 'E2E комната' })).toHaveCount(0);
});
