<script lang="ts">
	import type { SchemaReview } from '#lib/api/generated/social.ts';
	import { refHref } from '#lib/catalog/kinds.ts';
	import { displayName, isEdited, LONG_REVIEW, reviewDate } from '#lib/social/reviews.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import RatingBadge from './RatingBadge.svelte';

	let {
		review,
		showEntity = false,
		showAuthor = !showEntity
	}: {
		review: SchemaReview;
		/** О каком произведении рецензия (профиль, лента). */
		showEntity?: boolean;
		/** Автор (на карточке и в ленте — да, в профиле — и так известен). */
		showAuthor?: boolean;
	} = $props();

	let expanded = $state(false);
	const long = $derived((review.body?.length ?? 0) > LONG_REVIEW);
	const entityLink = $derived(refHref(review.entity));
</script>

<article class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
	{#if !showAuthor}
		<!-- В профиле автор и так известен: рецензия начинается с произведения. -->
		<header class="flex items-start gap-3">
			<div class="min-w-0 flex-1">
				{#if entityLink}
					<a href={entityLink} class="block truncate font-semibold hover:text-primary"
						>{review.entity.title}</a
					>
				{:else}
					<span class="block truncate font-semibold">{review.entity.title}</span>
				{/if}
				<p class="text-xs text-base-content/50">
					<time datetime={review.created_at}>{reviewDate(review.created_at)}</time>
					{#if isEdited(review)}· изменено{/if}
				</p>
			</div>
			{#if review.rating != null}<RatingBadge value={review.rating} />{/if}
		</header>
	{:else}
		<header class="flex items-center gap-3">
			<a href="/u/{review.author.username}" class="shrink-0" tabindex="-1" aria-hidden="true">
				<Avatar user={review.author} size="w-9" />
			</a>
			<div class="min-w-0 flex-1">
				<a
					href="/u/{review.author.username}"
					class="block truncate font-semibold hover:text-primary">{displayName(review.author)}</a
				>
				<p class="text-xs text-base-content/50">
					<time datetime={review.created_at}>{reviewDate(review.created_at)}</time>
					{#if isEdited(review)}· изменено{/if}
				</p>
			</div>
			{#if review.rating != null}<RatingBadge value={review.rating} />{/if}
		</header>
		{#if showEntity && entityLink}
			<p class="mt-3 text-sm">
				<a href={entityLink} class="link font-semibold text-primary link-hover"
					>{review.entity.title}</a
				>
			</p>
		{/if}
	{/if}

	{#if review.body}
		<p
			class={[
				'mt-3 leading-relaxed whitespace-pre-line text-base-content/85',
				{ 'line-clamp-6': long && !expanded }
			]}
		>
			{review.body}
		</p>
		{#if long}
			<button class="btn mt-1 btn-link px-0 btn-sm" onclick={() => (expanded = !expanded)}>
				{expanded ? 'Свернуть' : 'Читать полностью'}
			</button>
		{/if}
	{:else if showEntity}
		<p class="mt-2 text-sm text-base-content/50">Оценка без рецензии</p>
	{/if}
</article>
