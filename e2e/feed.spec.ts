import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { registerAndSignIn } from './users';

// Интересы, лента и реалтайм. Второй участник (seed-пользователь user) действует через API:
// так один сценарий видит чужие действия вживую, а входов в UI — по одному на сценарий.
const ZONE_THREAD = '/forum/00000000-0000-4000-9100-000000000002';

test.beforeEach(async ({ page }) => {
	await page.route(
		/^https:\/\/(www\.youtube-nocookie\.com|rutube\.ru|image\.tmdb\.org|covers\.openlibrary\.org|steamcdn-a\.akamaihd\.net)\//,
		(r) => r.abort()
	);
});

const userMenu = (page: Page) => page.getByRole('button', { name: 'Меню пользователя' });

async function apiToken(request: APIRequestContext): Promise<string> {
	const response = await request.post('/api/v1/auth/login', {
		data: { login: 'user', password: 'password123' }
	});
	expect(response.ok()).toBe(true);
	return (await response.json()).access_token;
}

test('интересы: «Следить» на карточке, список в ленте, отписка', async ({ page, request }) => {
	await registerAndSignIn(page, request, 'wat');
	await page.goto('/films/dune-2021');
	await expect(userMenu(page)).toBeVisible();
	await page.getByRole('button', { name: '🔔 Следить' }).click();
	await expect(page.getByRole('button', { name: '🔔 Вы следите' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page
		.getByRole('navigation', { name: 'Основная навигация' })
		.getByRole('link', { name: 'Лента' })
		.click();
	await expect(page).toHaveURL('/feed');
	const interests = page.getByRole('list', { name: 'Интересы' });
	await expect(interests.getByRole('link', { name: 'Дюна' })).toHaveAttribute(
		'href',
		'/films/dune-2021'
	);

	await interests.getByRole('button', { name: 'Не следить: Дюна' }).click();
	await expect(interests).toHaveCount(0);
	await page.goto('/films/dune-2021');
	await expect(userMenu(page)).toBeVisible();
	await expect(page.getByRole('button', { name: '🔔 Следить' })).toBeVisible();
});

test('лента: новичку — популярное; после подписки — записи автора с причиной, фильтр', async ({
	page,
	request
}) => {
	await registerAndSignIn(page, request, 'fed');
	await page.goto('/feed');
	const feed = page.getByRole('list', { name: 'Лента' });
	await expect(feed).toContainText('популярное');
	await expect(feed).not.toContainText('вы подписаны');

	await page.goto('/u/author');
	await expect(userMenu(page)).toBeVisible();
	await page.getByRole('button', { name: 'Подписаться', exact: true }).click();
	await expect(page.getByRole('button', { name: /Вы подписаны/ })).toBeVisible();

	await page.goto('/feed');
	await expect(feed).toContainText('Автор форума — вы подписаны');
	await page
		.getByRole('navigation', { name: 'Что показывать' })
		.getByRole('link', { name: 'Темы' })
		.click();
	await expect(page).toHaveURL('/feed?type=thread');
	await expect(feed.getByRole('article').first()).toContainText('тема,');
	await expect(feed).not.toContainText('рецензия,');
});

test('реалтайм: чужое сообщение — плашка в теме, ответ на ваше — уведомление', async ({
	page,
	request
}) => {
	await registerAndSignIn(page, request, 'rt');
	const token = await apiToken(request);
	const headers = { authorization: `Bearer ${token}` };
	const threadId = ZONE_THREAD.split('/').pop()!;

	await page.goto(ZONE_THREAD);
	await expect(userMenu(page)).toBeVisible();

	// Своё сообщение — на него потом ответят.
	const mine = `E2E: моё ${Date.now()}`;
	await page.getByLabel('Ваш ответ в теме').fill(mine);
	await page.getByRole('button', { name: 'Отправить' }).click();
	const myPost = page
		.getByRole('list', { name: 'Сообщения' })
		.getByRole('article')
		.filter({ hasText: mine });
	await expect(myPost).toBeVisible();
	const myPostId = (await myPost.getAttribute('id'))!.replace('post-', '');

	// Другой пользователь отвечает на него через API.
	const reply = await request.post(`/api/v1/social/threads/${threadId}/posts`, {
		headers,
		data: { body: `E2E: ответ вам ${Date.now()}`, parent_id: myPostId }
	});
	expect(reply.ok()).toBe(true);
	const replyId = (await reply.json()).id as string;

	try {
		await expect(page.getByRole('button', { name: '1 новое сообщение — показать' })).toBeVisible();
		const toast = page.getByRole('status').filter({ hasText: 'Вам ответили' });
		await expect(toast).toContainText('Пикник на обочине, Сталкер и Зона в играх');

		await toast.getByRole('link').click();
		await expect(page).toHaveURL(new RegExp(`\\?post=${replyId}#post-${replyId}$`));
		await expect(page.locator(`[id="post-${replyId}"]`)).toContainText('в ответ @');
	} finally {
		await request.delete(`/api/v1/social/posts/${replyId}`, { headers });
		const me = page.locator(`[id="post-${myPostId}"]`);
		await page.goto(ZONE_THREAD);
		await expect(userMenu(page)).toBeVisible();
		await me.getByRole('button', { name: 'Удалить' }).click();
		await me.getByRole('button', { name: 'Удалить' }).click();
		await expect(me).toHaveCount(0);
	}
});
