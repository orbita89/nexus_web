<script lang="ts">
	import { displayName } from '#lib/social/reviews.ts';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import ReviewItem from '#lib/components/social/ReviewItem.svelte';
	import ThreadItem from '#lib/components/social/ThreadItem.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);
	const base = $derived(`/u/${user.username}`);
</script>

<Seo
	title="{displayName(user)} (@{user.username})"
	description="Профиль @{user.username} в Nexus: рецензии, оценки, темы форума и подписки."
/>

<div class="grid gap-10 lg:grid-cols-2">
	<section aria-labelledby="recent-reviews" class="min-w-0">
		<div class="mb-4 flex items-baseline justify-between gap-3">
			<h2 id="recent-reviews" class="text-xl font-bold">Последние рецензии</h2>
			{#if data.profile.reviews_count}
				<a href="{base}/reviews" class="link text-sm link-primary link-hover">Все →</a>
			{/if}
		</div>
		{#if data.reviews.error}
			<LoadError message={data.reviews.error} />
		{:else if data.reviews.data?.items.length}
			<ul class="flex flex-col gap-3">
				{#each data.reviews.data.items as review (review.id)}
					<li><ReviewItem {review} showEntity /></li>
				{/each}
			</ul>
		{:else}
			<p class="text-base-content/50">Оценок и рецензий пока нет.</p>
		{/if}
	</section>

	<section aria-labelledby="recent-threads" class="min-w-0">
		<div class="mb-4 flex items-baseline justify-between gap-3">
			<h2 id="recent-threads" class="text-xl font-bold">Темы на форуме</h2>
			{#if data.profile.threads_count}
				<a href="{base}/threads" class="link text-sm link-primary link-hover">Все →</a>
			{/if}
		</div>
		{#if data.threads.error}
			<LoadError message={data.threads.error} />
		{:else if data.threads.data?.items.length}
			<ul class="flex flex-col gap-3">
				{#each data.threads.data.items as thread (thread.id)}
					<li><ThreadItem {thread} showAuthor={false} /></li>
				{/each}
			</ul>
		{:else}
			<p class="text-base-content/50">Тем пока нет.</p>
		{/if}
	</section>
</div>
