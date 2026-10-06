<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { entityHref, kindByApi } from '#lib/catalog/kinds.ts';
	import { count, yearOf } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import RatingSummary from '#lib/components/catalog/RatingSummary.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import MyReview from '#lib/components/social/MyReview.svelte';
	import ReviewItem from '#lib/components/social/ReviewItem.svelte';
	import ReviewSortTabs from '#lib/components/social/ReviewSortTabs.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const entity = $derived(data.entity);
	const year = $derived(yearOf(entity.release_date));
	const name = $derived(`${entity.title}${year ? ` (${year})` : ''}`);
</script>

<Seo
	title="Рецензии: {name}"
	description="Рецензии и оценки зрителей: {kindByApi(
		entity.kind
	).one.toLowerCase()} «{name}» в Nexus."
/>

<header class="mb-8">
	<a href={entityHref(entity)} class="link text-sm text-primary link-hover">← {name}</a>
	<h1 class="mt-1 text-3xl font-black sm:text-4xl">Рецензии: {entity.title}</h1>
	{#if data.reviews.data}
		<p class="mt-1 text-sm text-base-content/50">
			{count(data.reviews.data.total, ['рецензия', 'рецензии', 'рецензий'])}
		</p>
	{/if}
</header>

<div class="grid gap-6 lg:grid-cols-[20rem_1fr]">
	<div class="flex flex-col gap-4">
		{#if data.rating}<RatingSummary rating={data.rating} />{/if}
		<MyReview slug={entity.slug} onchange={() => invalidateAll()} />
	</div>
	<div class="min-w-0">
		{#if data.reviews.error}
			<LoadError message={data.reviews.error} />
		{:else if data.reviews.data?.items.length}
			<div class="mb-4 overflow-x-auto"><ReviewSortTabs current={data.sort} /></div>
			<ul class="flex flex-col gap-3" aria-label="Рецензии">
				{#each data.reviews.data.items as review (review.id)}
					<li><ReviewItem {review} /></li>
				{/each}
			</ul>
			<Pagination
				total={data.reviews.data.total}
				limit={data.reviews.data.limit}
				offset={data.reviews.data.offset}
			/>
		{:else}
			<EmptyState title="Рецензий пока нет">Напишите первую — форма слева.</EmptyState>
		{/if}
	</div>
</div>
