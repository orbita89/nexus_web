<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import type { Ratings } from '#lib/catalog/load.ts';
	import EntityCard from './EntityCard.svelte';

	let {
		entities,
		caption,
		showKind = false,
		ratings = {}
	}: {
		entities: SchemaEntitySummary[];
		/** Подпись под карточкой: роль человека в работе. */
		caption?: (entity: SchemaEntitySummary) => string | undefined;
		showKind?: boolean;
		/** Оценки по slug (ratingsFor). */
		ratings?: Ratings;
	} = $props();
</script>

<ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
	{#each entities as entity (entity.id)}
		<li>
			<EntityCard {entity} {showKind} caption={caption?.(entity)} rating={ratings[entity.slug]} />
		</li>
	{/each}
</ul>
