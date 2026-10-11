<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import type { Ratings } from '#lib/catalog/load.ts';
	import EntityCard from './EntityCard.svelte';

	let {
		entities,
		label,
		ratings = {}
	}: { entities: SchemaEntitySummary[]; label: string; ratings?: Ratings } = $props();
</script>

<!-- Полоса постеров: на телефоне листается пальцем, на десктопе — колесом или тачпадом. -->
<ul class="flex snap-x gap-4 overflow-x-auto pt-1.5 pb-3" aria-label={label}>
	{#each entities as entity (entity.id)}
		<li class="w-32 shrink-0 snap-start sm:w-36 lg:w-40">
			<EntityCard {entity} rating={ratings[entity.slug]} />
		</li>
	{/each}
</ul>
