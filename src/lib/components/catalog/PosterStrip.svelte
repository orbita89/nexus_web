<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import EntityCard from './EntityCard.svelte';

	let { entities, label }: { entities: SchemaEntitySummary[]; label: string } = $props();
</script>

<!-- Полоса постеров: на телефоне листается пальцем, на десктопе — колесом или тачпадом. -->
<ul class="flex snap-x gap-4 overflow-x-auto pt-1.5 pb-3" aria-label={label}>
	{#each entities as entity (entity.id)}
		<li class="w-32 shrink-0 snap-start sm:w-36 lg:w-40"><EntityCard {entity} /></li>
	{/each}
</ul>
