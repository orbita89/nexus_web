import { expect, test, type Page } from '@playwright/test';
import { registerAndSignIn } from './users';

// Чат. На десктопе панель закреплена справа и видна всегда — открывать её не нужно
// (кнопка «Чат» в шапке там, наоборот, сворачивает панель).
const panelOf = (page: Page) => page.getByRole('complementary', { name: 'Чат' });

test('вкладка «Каталог» — сам чат, «Каналы» и «Чаты» — списки', async ({ page }) => {
	await page.goto('/');
	const panel = panelOf(page);

	// «Каталог» открывает ленту сразу, чипы переключают общие чаты.
	await panel.getByRole('tab', { name: 'Каталог' }).click();
	await expect(panel.getByText('Войдите', { exact: false })).toBeVisible();
	const chips = panel.getByRole('group', { name: 'Раздел каталога' });
	await expect(chips.getByRole('button', { name: /^Общий/ })).toBeVisible();
	await chips.getByRole('button', { name: /^Книги/ }).click();
	await expect(panel.getByText('Войдите', { exact: false })).toBeVisible();

	// «Каналы» — список с переключателем.
	await panel.getByRole('tab', { name: 'Каналы' }).click();
	await expect(panel.getByLabel('Найти канал')).toBeVisible();
	await panel.getByRole('button', { name: 'Обсуждается' }).click();
	await expect(panel.getByLabel('Найти комнату')).toBeVisible();
	await panel.getByRole('button', { name: 'Мои каналы' }).click();
	await expect(panel.getByLabel('Найти канал')).toBeVisible();
	await expect(panel.getByRole('link', { name: 'Каталог комнат' }).last()).toBeVisible();

	// «Чаты» — личные переписки, отдельный список.
	await panel.getByRole('tab', { name: 'Чаты' }).click();
	await expect(panel.getByLabel('Найти переписку')).toBeVisible();
});

test('системный чат: сообщение и переход в профиль автора', async ({ page, request }) => {
	const { username } = await registerAndSignIn(page, request, 'chat');
	const panel = panelOf(page);

	await panel.getByRole('tab', { name: 'Каталог' }).click();
	// В системном чате состоят все: ни шапки, ни «Вступить» — сразу поле ввода.
	const composer = panel.getByLabel('Сообщение');
	await expect(composer).toBeVisible();

	const body = `e2e ${Date.now().toString(36)}`;
	await composer.fill(body);
	await panel.getByRole('button', { name: 'Отправить' }).click();
	await expect(panel.getByText(body, { exact: true })).toBeVisible();

	// Общий чат открывается вкладкой, поэтому заглушить и убрать его можно из шапки панели.
	await panel.getByRole('button', { name: 'Заглушить' }).click();
	await expect(panel.getByRole('button', { name: 'Вернуть уведомления' })).toBeVisible();
	await panel.getByRole('button', { name: 'Убрать из списка' }).click();
	await expect(panel.getByText('Убран из «Моих чатов»')).toBeVisible();
	await panel.getByRole('button', { name: 'Вернуть', exact: true }).click();
	await expect(panel.getByText('Убран из «Моих чатов»')).toHaveCount(0);

	// Имя автора раскрывает меню: оттуда — в профиль.
	await panel.getByRole('button', { name: username }).first().click();
	await panel.getByRole('link', { name: 'Профиль' }).click();
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

	// Чат интереса — в списке «Каналы», а не только в открытой комнате.
	await panel.getByRole('tab', { name: 'Каналы' }).click();
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
	await panel.getByRole('tab', { name: 'Каналы' }).click();
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
		await panel.getByRole('tab', { name: 'Каналы' }).click();

		const body = `e2e ${Date.now().toString(36)}`;
		const writerPanel = panelOf(writer);
		await writerPanel.getByRole('tab', { name: 'Каталог' }).click();
		await writerPanel.getByLabel('Сообщение').fill(body);
		await writerPanel.getByRole('button', { name: 'Отправить' }).click();
		await expect(writerPanel.getByText(body, { exact: true })).toBeVisible();

		// У читателя — значок непрочитанного на вкладке «Каталог».
		const generalTab = panel.getByRole('tab', { name: /^Каталог/ });
		await expect(generalTab.getByLabel(/^Непрочитанных: /)).toBeVisible();

		// Открыл, прочитал — значок этого чата пропал. У вкладки он суммарный по разделам,
		// поэтому смотрим на чип «Общий».
		await generalTab.click();
		await expect(panel.getByText(body, { exact: true })).toBeVisible();
		const generalChip = panel
			.getByRole('group', { name: 'Раздел каталога' })
			.getByRole('button', { name: /^Общий/ });
		await expect(generalChip.getByLabel(/^Непрочитанных: /)).toHaveCount(0);

		// Остальное непрочитанное (другие общие чаты) снимается одной кнопкой.
		await panel.getByRole('button', { name: 'Прочитать всё' }).click();
		await expect(panel.getByLabel(/^Непрочитанных: /)).toHaveCount(0);
		await expect(panel.getByRole('button', { name: 'Прочитать всё' })).toHaveCount(0);
	} finally {
		await readerContext.close();
		await writerContext.close();
	}
});

test('картинка: загрузка, отправка и показ в ленте', async ({ page, request }) => {
	await registerAndSignIn(page, request, 'img');
	const panel = panelOf(page);
	await panel.getByRole('tab', { name: 'Каталог' }).click();

	// Однопиксельный PNG: проверяем путь целиком, а не качество сжатия.
	const png = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
		'base64'
	);
	await panel
		.getByLabel('Картинка')
		.setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: png });

	// Превью до отправки: видно, что выбрано, и можно передумать.
	await expect(panel.getByAltText('Выбранная картинка')).toBeVisible({ timeout: 15000 });

	// Текст не обязателен — сообщение уходит с одной картинкой.
	await panel.getByRole('button', { name: 'Отправить' }).click();
	// Общий чат делят все прогоны, поэтому смотрим на последнее сообщение.
	await expect(panel.getByAltText('Картинка в сообщении').last()).toBeVisible();
	await expect(panel.getByAltText('Выбранная картинка')).toHaveCount(0);
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
