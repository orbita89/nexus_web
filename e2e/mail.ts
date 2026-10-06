// Письма бэкенда в dev ловит Mailpit (http://localhost:8025). Ссылки в письмах ведут на
// APP_BASE_URL бэкенда, поэтому берём из ссылки только путь и token и открываем у себя.
import { expect, type APIRequestContext } from '@playwright/test';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

type Summary = { ID: string; Created: string };

export function uniqueEmail(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** Ждёт письмо на адрес со ссылкой на `path` и возвращает путь с query (`/auth/...?token=...`). */
export async function linkFromMail(
	request: APIRequestContext,
	to: string,
	path: string
): Promise<string> {
	const pattern = new RegExp(`https?://[^\\s"'<>]+${path.replace(/\//g, '\\/')}\\?token=[\\w-]+`);
	let found: string | null = null;
	await expect
		.poll(
			async () => {
				const search = await request.get(`${MAILPIT}/api/v1/search`, {
					params: { query: `to:"${to}"` }
				});
				const { messages } = (await search.json()) as { messages: Summary[] };
				for (const message of messages) {
					const full = await request.get(`${MAILPIT}/api/v1/message/${message.ID}`);
					const { Text } = (await full.json()) as { Text: string };
					const match = Text.match(pattern);
					if (match) {
						const url = new URL(match[0]);
						found = url.pathname + url.search;
						return true;
					}
				}
				return false;
			},
			{ message: `письмо на ${to} со ссылкой ${path}`, timeout: 15_000 }
		)
		.toBe(true);
	return found!;
}
