import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { SchemaReview } from '#lib/api/generated/social.ts';
import '../../../routes/layout.css';
import ReviewCard from './ReviewCard.svelte';

const review = (extra: object = {}): SchemaReview =>
	({
		id: 'r1',
		rating: 9,
		body: 'Пол выживает в пустыне.',
		created_at: '2026-10-01T10:00:00Z',
		updated_at: '2026-10-01T10:00:00Z',
		author: { id: 'u1', username: 'paul' },
		entity: { id: 'e1', kind: 'movie', slug: 'dune-2021', title: 'Дюна' },
		...extra
	}) as SchemaReview;

describe('ReviewCard', () => {
	it('без спойлера — текст виден сразу', async () => {
		render(ReviewCard, { review: review() });
		await expect.element(page.getByText('Пол выживает в пустыне.')).toBeVisible();
		await expect.element(page.getByRole('button', { name: /Спойлер/ })).not.toBeInTheDocument();
	});

	it('спойлер размыт и скрыт от скринридера, по клику открывается', async () => {
		render(ReviewCard, { review: review({ is_spoiler: true }) });
		const body = page.getByTestId('review-body');
		await expect.element(body).toHaveClass(/blur-md/);
		await expect.element(body).toHaveAttribute('aria-hidden', 'true');

		await page.getByRole('button', { name: 'Спойлер. Нажмите, чтобы открыть' }).click();
		await expect.element(body).not.toHaveClass(/blur-md/);
		await expect.element(body).not.toHaveAttribute('aria-hidden');
		await expect.element(page.getByText('Пол выживает в пустыне.')).toBeVisible();
	});

	it('длинный текст свёрнут, «Читать полностью» разворачивает', async () => {
		const long = Array.from({ length: 30 }, (_, i) => `Строка ${i + 1}`).join('\n');
		render(ReviewCard, { review: review({ body: long }) });
		const more = page.getByRole('button', { name: 'Читать полностью' });
		await expect.element(more).toHaveAttribute('aria-expanded', 'false');
		await more.click();
		await expect
			.element(page.getByRole('button', { name: 'Свернуть' }))
			.toHaveAttribute('aria-expanded', 'true');
	});

	it('под текстом — лайк, дизлайк и комментарии; комментарии раскрываются', async () => {
		render(ReviewCard, { review: review() });
		const actions = page.getByRole('group', { name: 'Реакции на рецензию' });
		await expect.element(actions.getByLabelText('Нравится', { exact: true })).toBeInTheDocument();
		await expect.element(actions.getByLabelText('Не нравится')).toBeInTheDocument();
		const toggle = actions.getByRole('button', { name: /Комментарии/ });
		await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
		await toggle.click();
		await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect.element(page.getByText('Комментарии к рецензиям появятся позже.')).toBeVisible();
	});
});
