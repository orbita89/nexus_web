import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { JournalItem } from '#lib/social/journal.ts';
import '../../../routes/layout.css';
import JournalItemCard from './JournalItemCard.svelte';

const item = (extra: Partial<JournalItem> = {}): JournalItem => ({
	entity: { id: 'e1', kind: 'movie', slug: 'dune-2021', title: 'Дюна', release_date: '2021-10-22' },
	actions: ['like', 'rating'],
	rating: 9,
	last_activity_at: '2026-10-01T10:00:00Z',
	...extra
});

describe('JournalItemCard', () => {
	it('рисует чипы по действиям', async () => {
		render(JournalItemCard, { item: item() });
		await expect.element(page.getByText('Лайк')).toBeVisible();
		await expect.element(page.getByText('Оценка 9')).toBeVisible();
		await expect.element(page.getByText('Рецензия', { exact: true })).not.toBeInTheDocument();
	});

	it('название — ссылка на карточку, год рядом', async () => {
		render(JournalItemCard, { item: item() });
		await expect
			.element(page.getByRole('link', { name: 'Дюна' }))
			.toHaveAttribute('href', '/films/dune-2021');
		await expect.element(page.getByText('2021 · Фильм')).toBeVisible();
	});

	it('без заметки блока заметки нет', async () => {
		render(JournalItemCard, { item: item() });
		await expect.element(page.getByText('Заметка')).not.toBeInTheDocument();
	});

	it('заметка лежит в <details>', async () => {
		render(JournalItemCard, {
			item: item({ actions: ['note'], note: { body: 'Пересмотреть' } })
		});
		await expect.element(page.getByText('Заметка', { exact: true }).first()).toBeVisible();
	});

	it('рецензия со спойлером скрыта за кнопкой', async () => {
		render(JournalItemCard, {
			item: item({
				actions: ['review'],
				review: { id: 'r1', body: 'Умирает Лето', is_spoiler: true, excerpt: 'Умирает Лето' }
			})
		});
		await expect.element(page.getByText('Умирает Лето')).not.toBeInTheDocument();
		await page.getByRole('button', { name: /показать/ }).click();
		await expect.element(page.getByText('Умирает Лето')).toBeVisible();
	});
});
