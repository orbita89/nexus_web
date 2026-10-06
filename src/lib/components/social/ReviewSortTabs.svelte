<script lang="ts">
	import { page } from '$app/state';
	import { filterUrl } from '#lib/catalog/url.ts';
	import { REVIEW_SORTS, sortParam, type ReviewSort } from '#lib/social/reviews.ts';

	/** Сортировка рецензий ссылками: ?sort=rating_desc, страница остаётся на месте. */
	let { current }: { current: ReviewSort } = $props();
</script>

<nav class="tabs tabs-box w-fit tabs-sm" aria-label="Сортировка рецензий">
	{#each REVIEW_SORTS as sort (sort.value)}
		<a
			href={filterUrl(page.url, { sort: sortParam(sort.value) })}
			data-sveltekit-noscroll
			class={['tab', { 'tab-active': sort.value === current }]}
			aria-current={sort.value === current ? 'page' : undefined}>{sort.title}</a
		>
	{/each}
</nav>
