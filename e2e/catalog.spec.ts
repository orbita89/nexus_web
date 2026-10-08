import { expect, test, type Locator, type Page } from '@playwright/test';

// Каталог публичный: без входа, данные — из make seed (nexus_project/seeds/catalog.sql).

test('раздел: фильтр по тегу меняет адрес и выдачу, «назад» возвращает', async ({ page }) => {
	await page.goto('/films');
	await expect(page.getByRole('heading', { name: 'Фильмы', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Дюна\s+2021/ })).toBeVisible();

	await page.getByLabel('Тег').selectOption({ label: 'Ужасы' });
	await expect(page).toHaveURL('/films?tag=horror');
	await expect(page.getByRole('heading', { name: 'Фильмы · Ужасы', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Сияние\s+1980/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Дюна\s+2021/ })).toHaveCount(0);

	await page.goBack();
	await expect(page).toHaveURL('/films');
	await expect(page.getByRole('link', { name: /^Дюна\s+2021/ })).toBeVisible();

	// Ссылкой можно поделиться: тот же адрес с нуля даёт ту же выдачу.
	await page.goto('/films?tag=horror&q=%D1%81%D0%B8%D1%8F');
	await expect(page.getByLabel('Тег')).toHaveValue('horror');
	await expect(page.getByRole('searchbox', { name: 'Название' })).toHaveValue('сия');
	await expect(page.getByRole('link', { name: /^Сияние\s+1980/ })).toBeVisible();
});

test('карточка: участники, переход на человека и обратно к работе', async ({ page }) => {
	await page.goto('/films/dune-2021');
	await expect(page.getByRole('heading', { name: 'Дюна', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Научная фантастика' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Шапка: Дюна' })).toContainText('2 ч 35 мин');
	await expect(page.getByRole('region', { name: 'Оценка Nexus' })).toBeVisible();

	const credits = page.getByRole('region', { name: 'Участники' });
	await expect(credits).toContainText('Актёр · Пол Атрейдес');
	await credits.getByRole('link', { name: /Дени Вильнёв/ }).click();

	await expect(page).toHaveURL('/people/denis-villeneuve');
	await expect(page.getByRole('heading', { name: 'Дени Вильнёв', level: 1 })).toBeVisible();
	const work = page.getByRole('link', { name: /^Дюна\s+2021 · Фильм\s+Режиссёр/ });
	await expect(work).toBeVisible();
	await work.click();
	await expect(page).toHaveURL('/films/dune-2021');
});

test('чужой раздел в адресе — 301 на правильный, неизвестный slug — 404', async ({ request }) => {
	const wrong = await request.get('/books/dune-2021?x=1', { maxRedirects: 0 });
	expect(wrong.status()).toBe(301);
	expect(wrong.headers()['location']).toBe('/films/dune-2021?x=1');

	expect((await request.get('/films/no-such-entity')).status()).toBe(404);
	expect((await request.get('/people/no-such-person')).status()).toBe(404);
	expect((await request.get('/tags/no-such-tag')).status()).toBe(404);
});

test('карточка рендерится на сервере: заголовок и описание в HTML без JS', async ({
	request,
	browser
}) => {
	const html = await (await request.get('/films/dune-2021')).text();
	expect(html).toContain('<title>Дюна (2021) — Nexus</title>');
	expect(html).toMatch(/<meta name="description" content="Первая часть экранизации/);
	expect(html).toContain('Дени Вильнёв');

	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/films/dune-2021');
	await expect(page.getByRole('heading', { name: 'Дюна', level: 1 })).toBeVisible();
	await context.close();
});

test('карточка — статика: живого в HTML нет, блоки грузятся в браузере, нижние — по прокрутке', async ({
	page,
	request
}) => {
	// В HTML — каталог и заголовки разделов, но не рецензии: они устарели бы в статике.
	const html = await (await request.get('/films/dune-2021')).text();
	expect(html).toContain('Оценки и рецензии');
	expect(html).not.toContain('Вильнёв сделал невозможное');

	// Низкое окно: «В коллекциях» заведомо ниже экрана, что бы ни грузилось выше.
	await page.setViewportSize({ width: 1280, height: 500 });
	const asked: string[] = [];
	page.on('request', (r) => {
		const match = /\/social\/entities\/dune-2021\/(\w+)/.exec(r.url());
		if (match) asked.push(match[1]);
	});
	await page.goto('/films/dune-2021');
	await expect(page.getByRole('list', { name: 'Рецензии' })).toContainText(
		'Вильнёв сделал невозможное'
	);
	expect(asked).toContain('rating');
	expect(asked).not.toContain('collections');

	await page.getByRole('heading', { name: 'В коллекциях' }).scrollIntoViewIfNeeded();
	await expect(page.getByRole('list', { name: 'В коллекциях' })).toContainText(
		'Дюна во всех видах'
	);
	expect(asked).toContain('collections');
});

test('теги: список и сущности с тегом, фильтр по разделу', async ({ page }) => {
	await page.goto('/tags');
	await page.getByRole('link', { name: /Научная фантастика/ }).click();
	await expect(page).toHaveURL('/tags/sci-fi');
	await expect(page.getByRole('heading', { name: 'Научная фантастика', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Дюна\s+1965 · Книга/ })).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Раздел' })
		.getByRole('link', { name: 'Фильмы' })
		.click();
	await expect(page).toHaveURL('/tags/sci-fi?kind=films');
	await expect(page.getByRole('link', { name: /^Дюна\s+1965/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /^Дюна\s+2021/ })).toBeVisible();
});

test('люди: поиск по имени', async ({ page }) => {
	await page.goto('/people');
	await page.getByRole('searchbox', { name: 'Поиск по имени' }).fill('кинг');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL('/people?q=%D0%BA%D0%B8%D0%BD%D0%B3');
	await page.getByRole('link', { name: /Стивен Кинг/ }).click();
	await expect(page.getByRole('heading', { name: 'Стивен Кинг', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /Сияние\s+1977 · Книга\s+Автор/ })).toBeVisible();
});

test('поиск: результаты, пустой запрос — подсказка', async ({ page }) => {
	await page.goto('/search');
	await expect(page.getByText('Ищите по названию')).toBeVisible();
	await page.getByRole('link', { name: 'Дюна', exact: true }).click();
	await expect(page).toHaveURL('/search?q=%D0%94%D1%8E%D0%BD%D0%B0');
	await expect(page.getByRole('link', { name: /^Дюна\s+2021 · Фильм/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Дюна\s+1965 · Книга/ })).toBeVisible();
});

// Трейлеры. Источники берутся из ответа API (metadata.trailers у dune-2021: YouTube, затем
// Rutube), адрес плеера строит фронтенд по шаблону провайдера — его и проверяем. Видеосервисы
// и CDN картинок подменены: в CI сети к ним может не быть, поэтому проверяется адрес плеера,
// а не воспроизведение. Таймаут ожидания (8 с) проматывается часами Playwright.
let YOUTUBE: string;
let RUTUBE: string;

test.beforeAll(async ({ request }) => {
	const entity = await (await request.get('/api/v1/catalog/entities/dune-2021')).json();
	const trailers: { provider: string; id: string }[] = entity.metadata.trailers;
	expect(trailers.map((t) => t.provider)).toEqual(['youtube', 'rutube']);
	YOUTUBE = `https://www.youtube-nocookie.com/embed/${trailers[0].id}`;
	RUTUBE = `https://rutube.ru/play/embed/${trailers[1].id}`;
});

const PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

type YoutubeStub = 'silent' | 'blocked' | 'plays' | 'late-handshake' | 'loaded-only';
type RutubeStub = 'silent' | 'blocked' | 'plays' | 'plays-on-command';

// Заглушки плееров ведут себя как настоящие: шлют события родителю со своего origin.
const stubPage = (script: string) =>
	`<!doctype html><title>player</title><script>const send = (m) => parent.postMessage(JSON.stringify(m), '*');${script}</script>`;
const YOUTUBE_STUB: Record<Exclude<YoutubeStub, 'blocked'>, string> = {
	silent: '',
	// Отвечает на рукопожатие: загрузился и играет.
	plays: `addEventListener('message', (e) => { if (String(e.data).includes('listening')) { send({ event: 'onReady' }); send({ event: 'onStateChange', info: 1 }); } });`,
	// Медленный плеер: первые два рукопожатия теряются.
	'late-handshake': `let n = 0; addEventListener('message', (e) => { if (String(e.data).includes('listening') && ++n === 3) { send({ event: 'onReady' }); send({ event: 'onStateChange', info: 1 }); } });`,
	// Загрузился, но видео не стартует (автозапуск не дали).
	'loaded-only': `addEventListener('message', (e) => { if (String(e.data).includes('listening')) send({ event: 'onReady' }); });`
};
const RUTUBE_STUB: Record<Exclude<RutubeStub, 'blocked'>, string> = {
	silent: '',
	plays: `send({ type: 'player:changeState', data: { state: 'playing' } });`,
	// Как настоящий Rutube: mute=1 в адресе не понимает и сам не стартует — только по команде.
	'plays-on-command': `send({ type: 'player:ready', data: {} }); addEventListener('message', (e) => { if (String(e.data).includes('player:play')) send({ type: 'player:changeState', data: { state: 'playing' } }); });`
};

async function stubMedia(
	page: Page,
	{ youtube = 'silent', rutube = 'silent' }: { youtube?: YoutubeStub; rutube?: RutubeStub } = {}
) {
	await page.route(/^https:\/\/(image\.tmdb\.org|covers\.openlibrary\.org)\//, (route) =>
		route.fulfill({ body: PIXEL, contentType: 'image/png' })
	);
	await page.route('https://www.youtube-nocookie.com/**', (route) =>
		youtube === 'blocked'
			? route.abort('blockedbyclient')
			: route.fulfill({ body: stubPage(YOUTUBE_STUB[youtube]), contentType: 'text/html' })
	);
	await page.route('https://rutube.ru/**', (route) =>
		rutube === 'blocked'
			? route.abort('blockedbyclient')
			: route.fulfill({ body: stubPage(RUTUBE_STUB[rutube]), contentType: 'text/html' })
	);
}

const isVisible = (frame: Locator) => frame.evaluate((el) => getComputedStyle(el).opacity === '1');

const playerFrame = (page: Page) =>
	page.getByRole('dialog', { name: 'Трейлер: Дюна' }).locator('iframe');
const heroFrame = (page: Page) =>
	page.getByRole('region', { name: 'Шапка: Дюна' }).locator('iframe');

test('карточка как у Okko: трейлер — фон шапки без звука, постера нет', async ({ page }) => {
	await stubMedia(page);
	await page.goto('/films/dune-2021');
	const hero = page.getByRole('region', { name: 'Шапка: Дюна' });
	await expect(hero.getByRole('heading', { name: 'Дюна', level: 1 })).toBeVisible();
	await expect(hero).toContainText('2 ч 35 мин');
	await expect(hero.getByRole('link', { name: 'Дени Вильнёв' })).toBeVisible();

	const frame = heroFrame(page);
	await expect(frame).toHaveAttribute('src', new RegExp(`^${YOUTUBE}\\?`));
	const params = new URL((await frame.getAttribute('src'))!).searchParams;
	expect(Object.fromEntries(params)).toMatchObject({ autoplay: '1', mute: '1', controls: '0' });
	await expect(page.getByRole('img', { name: 'Обложка: Дюна' })).toHaveCount(0);

	await hero.getByRole('button', { name: 'Включить звук' }).click();
	await expect(hero.getByRole('button', { name: 'Выключить звук' })).toBeVisible();
	await hero.getByRole('button', { name: 'Пауза' }).click();
	await expect(hero.getByRole('button', { name: 'Продолжить фон' })).toBeVisible();
});

test('фон: YouTube недоступен — сам переходит на Rutube', async ({ page }) => {
	await page.clock.install();
	await stubMedia(page, { youtube: 'blocked' });
	await page.goto('/films/dune-2021');
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${YOUTUBE}`));
	await page.clock.runFor(8500);
	await expect(heroFrame(page)).toHaveAttribute('src', `${RUTUBE}?autoplay=1&mute=1`);
});

test('фон: Rutube стартует по команде «играть» и проявляется', async ({ page }) => {
	await page.clock.install();
	await stubMedia(page, { youtube: 'blocked', rutube: 'plays-on-command' });
	await page.goto('/films/dune-2021');
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${YOUTUBE}`));
	await page.clock.runFor(8500);
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${RUTUBE}`));
	await page.clock.runFor(1000);
	await expect.poll(() => isVisible(heroFrame(page))).toBe(true);
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('nexus.trailer.provider')))
		.toBe('rutube');
});

test('фон: медленный YouTube — рукопожатие повторяется, источник не меняется', async ({ page }) => {
	await page.clock.install();
	await stubMedia(page, { youtube: 'late-handshake' });
	await page.goto('/films/dune-2021');
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${YOUTUBE}`));
	await page.clock.runFor(1500);
	await expect.poll(() => isVisible(heroFrame(page))).toBe(true);
	await page.clock.runFor(8500);
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${YOUTUBE}`));
});

test('фон: плеер загрузился, но видео не пошло — следующий источник', async ({ page }) => {
	await page.clock.install();
	await stubMedia(page, { youtube: 'loaded-only', rutube: 'plays-on-command' });
	await page.goto('/films/dune-2021');
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${YOUTUBE}`));
	await page.clock.runFor(8500);
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${RUTUBE}`));
});

test('фон: при prefers-reduced-motion видео не запускается, кнопка «Трейлер» есть', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await stubMedia(page);
	await page.goto('/films/dune-2021');
	await expect(page.getByRole('button', { name: 'Трейлер' })).toBeVisible();
	await expect(heroFrame(page)).toHaveCount(0);
});

test('трейлер: кнопка открывает плеер YouTube, переключатель — Rutube, Esc закрывает', async ({
	page
}) => {
	await stubMedia(page);
	await page.goto('/films/dune-2021');
	// Плеер модалки не грузится заранее.
	await expect(playerFrame(page)).toHaveCount(0);

	await page.getByRole('button', { name: 'Трейлер' }).click();
	const dialog = page.getByRole('dialog', { name: 'Трейлер: Дюна' });
	await expect(dialog).toBeVisible();
	const frame = playerFrame(page);
	await expect(frame).toHaveAttribute('src', new RegExp(`^${YOUTUBE}\\?autoplay=1&`));
	await expect(frame).toHaveAttribute('title', 'Трейлер: Дюна');
	await expect(frame).toHaveAttribute('allow', /autoplay/);

	const switcher = dialog.getByRole('group', { name: 'Источник' });
	await expect(switcher.getByRole('button', { name: 'YouTube' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await switcher.getByRole('button', { name: 'Rutube' }).click();
	await expect(frame).toHaveAttribute('src', `${RUTUBE}?autoplay=1`);

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(playerFrame(page)).toHaveCount(0);
});

test('трейлер: YouTube недоступен — плеер сам переходит на Rutube', async ({ page }) => {
	await page.clock.install();
	await stubMedia(page, { youtube: 'blocked' });
	await page.goto('/films/dune-2021');
	await page.getByRole('button', { name: 'Трейлер' }).click();
	await expect(playerFrame(page)).toHaveAttribute('src', new RegExp(`^${YOUTUBE}`));

	await page.clock.runFor(8500);
	await expect(playerFrame(page)).toHaveAttribute('src', `${RUTUBE}?autoplay=1`);
	await expect(page.getByText('YouTube недоступен, показываем Rutube')).toBeVisible();
});

test('трейлер: ни один источник не запустился — сообщение вместо плеера', async ({ page }) => {
	await page.clock.install();
	await stubMedia(page, { youtube: 'blocked', rutube: 'blocked' });
	await page.goto('/films/dune-2021');
	await page.getByRole('button', { name: 'Трейлер' }).click();
	await page.clock.runFor(8500);
	await expect(playerFrame(page)).toHaveAttribute('src', new RegExp(`^${RUTUBE}`));
	await page.clock.runFor(8500);

	const dialog = page.getByRole('dialog', { name: 'Трейлер: Дюна' });
	await expect(dialog.getByText('Трейлер недоступен в вашем регионе')).toBeVisible();
	await expect(dialog.locator('iframe')).toHaveCount(0);
	// Фон шапки тоже не запустился — остаётся размытая обложка, без пустого плеера.
	await expect(heroFrame(page)).toHaveCount(0);
});

test('трейлер: сработавший источник запоминается и в следующий раз идёт первым', async ({
	page
}) => {
	await page.clock.install();
	await stubMedia(page, { youtube: 'blocked', rutube: 'plays' });
	await page.goto('/films/dune-2021');
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${YOUTUBE}`));
	await page.clock.runFor(8500);
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${RUTUBE}`));
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('nexus.trailer.provider')))
		.toBe('rutube');

	// Следующий показ сразу с Rutube и уже играет — по таймауту ничего не меняется.
	await page.reload();
	await expect(heroFrame(page)).toHaveAttribute('src', new RegExp(`^${RUTUBE}`));
	await page.getByRole('button', { name: 'Трейлер' }).click();
	await expect(playerFrame(page)).toHaveAttribute('src', new RegExp(`^${RUTUBE}`));
	await page.clock.runFor(8500);
	await expect(playerFrame(page)).toHaveAttribute('src', new RegExp(`^${RUTUBE}`));
	await expect(page.getByText(/недоступен/)).toHaveCount(0);
});

test('без трейлера — ни видео, ни кнопки, ни постера; постеры — в сетках разделов', async ({
	page
}) => {
	// У книг трейлеров не бывает по контракту; фильмы dev-база дополняет инструментом медиа
	// бэкенда, так что «фильм без трейлера» из сидов может трейлер получить.
	await stubMedia(page);
	await page.goto('/books/dune-novel');
	await expect(page.getByRole('heading', { name: 'Дюна', level: 1 })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Шапка: Дюна' })).toContainText(
		'Автор: Фрэнк Херберт'
	);
	await expect(page.locator('iframe')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Трейлер' })).toHaveCount(0);
	await expect(page.getByRole('img', { name: /^Обложка/ })).toHaveCount(0);

	await page.goto('/books');
	await expect(page.locator('a[href="/books/dune-novel"] img')).toHaveAttribute(
		'src',
		/^https:\/\/covers\.openlibrary\.org\//
	);
	await page.goto('/films');
	await expect(page.locator('a[href="/films/dune-2021"] img')).toHaveAttribute(
		'src',
		/^https:\/\/image\.tmdb\.org\//
	);
});

test('в подвале — атрибуция TMDB', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('contentinfo').getByRole('link', { name: 'TMDB' })).toHaveAttribute(
		'href',
		'https://www.themoviedb.org/'
	);
});
