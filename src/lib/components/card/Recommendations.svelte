<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { browserApi, liveQuery } from '#lib/social/card-live.svelte.ts';
	import PosterStrip from '#lib/components/catalog/PosterStrip.svelte';

	// «Рекомендации» под «О фильме» — подбор делает бэкенд: GET /catalog/entities/{slug}/similar →
	// Page<EntitySummary>, без токена. Только в браузере: в статике подборка устарела бы. Пока
	// грузится — скелетон постеров; пустая подборка или ошибка — раздела нет.
	let { slug }: { slug: string } = $props();

	const LIMIT = 12;
	/** Мест в скелетоне загрузки. */
	const PLACES = 6;

	const recommended = liveQuery(
		() => slug,
		async (slug) =>
			(
				await unwrap(
					browserApi().catalog.GET('/api/v1/catalog/entities/{slug}/similar', {
						params: { path: { slug }, query: { limit: LIMIT } }
					})
				)
			).items
	);
	const items = $derived(recommended.current?.data ?? []);
	const loading = $derived(!recommended.current);
</script>

{#if loading || items.length}
	<section aria-labelledby="recommendations-title" class="mb-14">
		<h2 id="recommendations-title" class="mb-4 text-2xl font-bold">Рекомендации</h2>
		{#if loading}
			<ul class="flex gap-4 overflow-hidden pt-1.5 pb-3" aria-hidden="true">
				{#each { length: PLACES }, i (i)}
					<li class="aspect-2/3 w-32 shrink-0 skeleton rounded-box sm:w-36 lg:w-40"></li>
				{/each}
			</ul>
		{:else}
			<PosterStrip entities={items} label="Рекомендации" />
		{/if}
	</section>
{/if}
