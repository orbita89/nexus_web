<script lang="ts">
	import { REVIEW_SORTS, type ReviewSort } from '#lib/social/reviews.ts';
	import SortTabs from './SortTabs.svelte';

	let { current }: { current: ReviewSort } = $props();
</script>

<SortTabs options={REVIEW_SORTS} {current} fallback="new" label="Сортировка рецензий" />
