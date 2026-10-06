<script lang="ts">
	import { count } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import ReviewItem from '#lib/components/social/ReviewItem.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title="Рецензии @{data.username}"
	description="Рецензии и оценки @{data.username} в Nexus: фильмы, сериалы, книги и игры."
/>

<header class="mb-8">
	<a href="/u/{data.username}" class="link text-sm text-primary link-hover">@{data.username}</a>
	<h1 class="mt-1 text-3xl font-black sm:text-4xl">Рецензии и оценки</h1>
	<p class="mt-1 text-sm text-base-content/50">
		{count(data.reviews.total, ['запись', 'записи', 'записей'])}
	</p>
</header>

{#if data.reviews.items.length}
	<ul class="flex max-w-3xl flex-col gap-3" aria-label="Рецензии">
		{#each data.reviews.items as review (review.id)}
			<li><ReviewItem {review} showEntity /></li>
		{/each}
	</ul>
	<Pagination total={data.reviews.total} limit={data.reviews.limit} offset={data.reviews.offset} />
{:else}
	<EmptyState title="Пока ничего">Здесь появятся оценки и рецензии @{data.username}.</EmptyState>
{/if}
