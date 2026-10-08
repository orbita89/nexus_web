<script lang="ts">
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaRatingSummary } from '#lib/api/generated/social.ts';
	import { count } from '#lib/catalog/labels.ts';
	import type { Loaded } from '#lib/catalog/load.ts';
	import { browserApi, liveQuery, type CardLive } from '#lib/social/card-live.svelte.ts';
	import { withQuery } from '#lib/catalog/url.ts';
	import { readSort, sortParam } from '#lib/social/reviews.ts';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import RatingSummary from '#lib/components/catalog/RatingSummary.svelte';
	import MyReview from './MyReview.svelte';
	import ReviewItem from './ReviewItem.svelte';
	import ReviewSortTabs from './ReviewSortTabs.svelte';

	// «Оценки и рецензии» на карточке: сводка (её грузит страница — она же в шапке), «Ваша
	// оценка» и первые рецензии с сортировкой ?sort=. Только в браузере (ClientSection).
	let {
		slug,
		rating,
		live
	}: { slug: string; rating: Loaded<SchemaRatingSummary> | null; live: CardLive } = $props();

	/** Рецензий на карточке; остальные — на /{раздел}/{slug}/reviews. */
	const LIMIT = 6;

	const sort = $derived(readSort(page.url));
	const reviews = liveQuery(
		() => ({ slug, sort, version: live.version }),
		({ slug, sort }) =>
			unwrap(
				browserApi().social.GET('/api/v1/social/entities/{slug}/reviews', {
					params: { path: { slug }, query: { sort, limit: LIMIT } }
				})
			)
	);
	const result = $derived(reviews.current);
</script>

<div class="grid gap-6 lg:grid-cols-[20rem_1fr]">
	<div class="flex flex-col gap-4">
		{#if rating?.data}<RatingSummary rating={rating.data} />{/if}
		<!-- Своё изменили — сводка и список перечитываются. -->
		<MyReview {slug} onchange={() => live.refresh()} />
	</div>
	<div class="min-w-0">
		{#if !result}
			<div class="h-32 animate-pulse rounded-box bg-base-200" aria-hidden="true"></div>
		{:else if !result.data}
			<LoadError message={result.error} onretry={reviews.retry} />
		{:else if result.data.items.length}
			{#if result.data.total > 1}
				<div class="mb-4 overflow-x-auto"><ReviewSortTabs current={sort} /></div>
			{/if}
			<ul class="flex flex-col gap-3" aria-label="Рецензии">
				{#each result.data.items as review (review.id)}
					<li><ReviewItem {review} onremoved={() => live.refresh()} /></li>
				{/each}
			</ul>
			<a
				href={withQuery(`${page.url.pathname}/reviews`, { sort: sortParam(sort) })}
				class="mt-4 inline-block link text-sm link-primary link-hover"
				>Все рецензии ({result.data.total}) →</a
			>
		{:else}
			<p
				class="rounded-box border border-dashed border-base-300 p-6 text-center text-base-content/60"
			>
				Рецензий пока нет{rating?.data?.count
					? `, но уже ${count(rating.data.count, ['оценка', 'оценки', 'оценок'])}`
					: ''}. Напишите первую!
			</p>
		{/if}
	</div>
</div>
