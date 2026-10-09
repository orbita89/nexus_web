<script lang="ts">
	import { page } from '$app/state';
	import type { SchemaReview } from '#lib/api/generated/social.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { ReviewVote, reviewCount, type Vote } from '#lib/social/review-votes.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import ReviewComments from './ReviewComments.svelte';

	// Под рецензией: 👍 / 👎 (взаимоисключающие, повторный клик снимает) и «Комментарии» —
	// раскрывает ReviewComments. За свою рецензию голосовать нельзя (числа видно). Гостю — вход.
	// Счётчики — из рецензии, если бэкенд их присылает; свой голос (пока в браузере) прибавляется.
	let { review }: { review: SchemaReview } = $props();

	const vote = new ReviewVote(() => review.id);
	let open = $state(false);

	const own = $derived(session.user?.id === review.author.id);
	const likes = $derived(reviewCount(review, 'likes_count') + (vote.vote === 1 ? 1 : 0));
	const dislikes = $derived(reviewCount(review, 'dislikes_count') + (vote.vote === -1 ? 1 : 0));
	const comments = $derived(reviewCount(review, 'comments_count'));

	const action =
		'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-sm text-base-content/55 transition-colors hover:bg-base-content/5 hover:text-base-content disabled:pointer-events-none';
</script>

{#snippet thumb(down: boolean, filled: boolean)}
	<svg
		class={['size-4', { 'rotate-180': down }]}
		viewBox="0 0 24 24"
		fill={filled ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" /><path
			d="M7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.3 8A2 2 0 0 1 18.2 21H7"
		/></svg
	>
{/snippet}

{#snippet voteButton(value: Vote, label: string, count: number)}
	{@const on = vote.vote === value}
	{#if session.status === 'guest'}
		<a href={loginUrl(page.url)} class={action} aria-label={label}
			>{@render thumb(value === -1, false)}{#if count}<span class="tabular-nums">{count}</span
				>{/if}</a
		>
	{:else}
		<button
			class={[action, { 'text-primary hover:text-primary': on }]}
			aria-label={label}
			aria-pressed={on}
			disabled={own || session.status !== 'authed'}
			title={own ? 'Своя рецензия' : undefined}
			onclick={() => vote.toggle(value)}
			>{@render thumb(value === -1, on)}{#if count}<span class="tabular-nums">{count}</span
				>{/if}</button
		>
	{/if}
{/snippet}

<div
	class="mt-2 -ml-2.5 flex flex-wrap items-center gap-1"
	role="group"
	aria-label="Реакции на рецензию"
>
	{@render voteButton(1, 'Нравится', likes)}
	{@render voteButton(-1, 'Не нравится', dislikes)}
	<button
		class={[action, { 'text-base-content': open }]}
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<svg
			class="size-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg
		>
		Комментарии{#if comments}<span class="tabular-nums">{comments}</span>{/if}
	</button>
</div>
{#if open}<ReviewComments reviewId={review.id} />{/if}
