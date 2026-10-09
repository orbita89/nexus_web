<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { RECOMMENDATIONS_API } from '#lib/catalog/card.ts';
	import { liveQuery } from '#lib/social/card-live.svelte.ts';
	import PosterStrip from '#lib/components/catalog/PosterStrip.svelte';

	// «Рекомендации» под «О фильме» — подбор делает бэкенд: GET /catalog/entities/{slug}/similar →
	// Page<EntitySummary> (docs/backend-questions.md). Пока эндпоинта нет (RECOMMENDATIONS_API в
	// #lib/catalog/card.ts) — заглушка: пустые места под постеры, запросов нет. Появится — полоса
	// постеров; подборка пустая или не загрузилась — раздела нет. Только в браузере: в статике
	// подборка устарела бы.
	let { slug }: { slug: string } = $props();

	const LIMIT = 12;
	/** Мест в заглушке и в скелетоне загрузки. */
	const PLACES = 6;

	const recommended = liveQuery(
		() => slug,
		async (slug) => {
			if (!RECOMMENDATIONS_API) return null;
			const response = await fetch(
				`/api/v1/catalog/entities/${encodeURIComponent(slug)}/similar?limit=${LIMIT}`
			);
			if (!response.ok) throw new Error(String(response.status));
			return ((await response.json()) as { items: SchemaEntitySummary[] }).items;
		}
	);
	const items = $derived(recommended.current?.data ?? []);
	const loading = $derived(RECOMMENDATIONS_API && !recommended.current);
</script>

{#snippet places(stub: boolean)}
	<ul class="flex gap-4 overflow-hidden pt-1.5 pb-3" aria-hidden="true">
		{#each { length: PLACES }, i (i)}
			<li
				class={[
					'aspect-2/3 w-32 shrink-0 rounded-box sm:w-36 lg:w-40',
					stub ? 'border border-dashed border-base-content/15 bg-base-200/40' : 'skeleton'
				]}
			></li>
		{/each}
	</ul>
{/snippet}

{#if !RECOMMENDATIONS_API || loading || items.length}
	<section aria-labelledby="recommendations-title" class="mb-14">
		<h2 id="recommendations-title" class="mb-4 text-2xl font-bold">Рекомендации</h2>
		{#if !RECOMMENDATIONS_API}
			{@render places(true)}
			<p class="text-sm text-base-content/40">Подборка похожих появится позже.</p>
		{:else if loading}
			{@render places(false)}
		{:else}
			<PosterStrip entities={items} label="Рекомендации" />
		{/if}
	</section>
{/if}
