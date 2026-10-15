import { expect, test } from '@playwright/test';

// «Архив» в разделе: выключен по умолчанию, включённый — archive=1. Архив страница грузит сама:
// переключатель не перезапрашивает выдачу сайта. Есть ли архив на бэкенде (ARCHIVE_DIR), тут не
// важно — проверяем запросы.
test('архив: выключен по умолчанию, по названию, галочка не перезапрашивает выдачу', async ({
	page
}) => {
	const asked: string[] = [];
	page.on('request', (r) => {
		const url = new URL(r.url());
		if (url.pathname.startsWith('/api/v1/catalog/')) asked.push(url.pathname + url.search);
	});
	await page.goto('/films');
	const archive = page.getByRole('checkbox', { name: 'Архив' });
	await expect(archive).not.toBeChecked();
	expect(asked.filter((u) => u.startsWith('/api/v1/catalog/archive/'))).toEqual([]);

	asked.length = 0;
	// До гидрации галочка ещё не связана с адресом — повторяем, пока адрес не сменится.
	await expect(async () => {
		await archive.check();
		await expect(page).toHaveURL('/films?archive=1', { timeout: 1000 });
	}).toPass();
	// Архив ищется только по названию: без него запроса к архиву нет, страница так и пишет.
	await expect(page.getByText('архив ищется только по названию')).toBeVisible();
	expect(asked.filter((u) => u.startsWith('/api/v1/catalog/archive/'))).toEqual([]);
	// Выдача сайта не перезапрошена.
	expect(asked.filter((u) => u.startsWith('/api/v1/catalog/search?'))).toEqual([]);

	// С названием — запрос к архиву по нему.
	const byTitle = page.waitForRequest((r) => r.url().includes('/archive/search?q=kebab'));
	await page.goto('/films?archive=1&q=kebab');
	await byTitle;

	await expect(async () => {
		await page.getByRole('checkbox', { name: 'Архив' }).uncheck();
		await expect(page).toHaveURL('/films?q=kebab', { timeout: 1000 });
	}).toPass();
});
