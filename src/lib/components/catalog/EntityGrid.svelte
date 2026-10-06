<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import EntityCard from './EntityCard.svelte';

	let {
		entities,
		caption,
		showKind = false
	}: {
		entities: SchemaEntitySummary[];
		/** Подпись под карточкой: роль человека в работе. */
		caption?: (entity: SchemaEntitySummary) => string | undefined;
		showKind?: boolean;
	} = $props();
</script>

<ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
	{#each entities as entity (entity.id)}
		<li><EntityCard {entity} {showKind} caption={caption?.(entity)} /></li>
	{/each}
</ul>
