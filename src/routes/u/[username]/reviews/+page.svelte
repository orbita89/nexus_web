<script lang="ts">
	import { displayName } from '#lib/social/reviews.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import ReviewCard from '#lib/components/social/ReviewCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);
</script>

<Seo
	title="Рецензии — {displayName(user)} (@{user.username})"
	description="Рецензии и оценки @{user.username} в Nexus: фильмы, сериалы, книги и игры."
/>

<h2 class="sr-only">Рецензии и оценки</h2>
{#if data.reviews.items.length}
	<ul class="flex max-w-3xl flex-col gap-3" aria-label="Рецензии">
		{#each data.reviews.items as review (review.id)}
			<li><ReviewCard {review} showEntity /></li>
		{/each}
	</ul>
	<Pagination total={data.reviews.total} limit={data.reviews.limit} offset={data.reviews.offset} />
{:else}
	<EmptyState title="Пока ничего">Здесь появятся оценки и рецензии @{user.username}.</EmptyState>
{/if}
