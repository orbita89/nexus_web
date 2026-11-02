<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import type { Ratings } from '#lib/catalog/load.ts';
	import EntityCard from './EntityCard.svelte';

	let {
		entities,
		caption,
		showKind = false,
		wall = false,
		ratings = {}
	}: {
		entities: SchemaEntitySummary[];
		/** Подпись под карточкой: роль человека в работе. */
		caption?: (entity: SchemaEntitySummary) => string | undefined;
		showKind?: boolean;
		/** Стена картин: колонки вместо сетки, высота карточки — по холсту. */
		wall?: boolean;
		/** Оценки по slug (ratingsFor). */
		ratings?: Ratings;
	} = $props();
</script>

<!-- Стена картин — колонки (masonry): карточки разной высоты встают без дыр. -->
<ul
	class={wall
		? 'columns-2 gap-4 sm:columns-3 lg:columns-4 [&>li]:mb-6 [&>li]:break-inside-avoid'
		: 'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'}
>
	{#each entities as entity (entity.id)}
		<li>
			<EntityCard
				{entity}
				{showKind}
				{wall}
				caption={caption?.(entity)}
				rating={ratings[entity.slug]}
			/>
		</li>
	{/each}
</ul>
