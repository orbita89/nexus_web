<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import type { Ratings } from '#lib/catalog/load.ts';
	import EntityCard from './EntityCard.svelte';

	let {
		entities,
		label,
		ratings = {},
		badges = {}
	}: {
		entities: SchemaEntitySummary[];
		label: string;
		ratings?: Ratings;
		/** Подпись над постером по id: «Сиквел», «Ремейк». */
		badges?: Record<string, string>;
	} = $props();
</script>

<!-- Полоса постеров: на телефоне листается пальцем, на десктопе — колесом или тачпадом. -->
<ul class="flex snap-x gap-4 overflow-x-auto pt-1.5 pb-3" aria-label={label}>
	{#each entities as entity (entity.id)}
		<li class="w-32 shrink-0 snap-start sm:w-36 lg:w-40">
			{#if badges[entity.id]}
				<span class="mb-1.5 badge badge-ghost badge-sm">{badges[entity.id]}</span>
			{/if}
			<EntityCard {entity} rating={ratings[entity.slug]} />
		</li>
	{/each}
</ul>
