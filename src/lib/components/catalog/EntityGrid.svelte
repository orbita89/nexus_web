<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import type { Ratings } from '#lib/catalog/load.ts';
	import type { Row } from '#lib/catalog/row.ts';
	import ArtWall from './ArtWall.svelte';
	import EntityCard from './EntityCard.svelte';

	let {
		entities,
		caption,
		showKind = false,
		wall = false,
		row,
		ratings = {}
	}: {
		entities: SchemaEntitySummary[];
		/** Подпись под карточкой: роль человека в работе. */
		caption?: (entity: SchemaEntitySummary) => string | undefined;
		showKind?: boolean;
		/** Стена картин: колонки вместо сетки, высота карточки — по холсту. */
		wall?: boolean;
		/** Параметры этой выдачи: по ним карточка листает соседние работы (row.ts). */
		row?: Row;
		/** Оценки по slug (ratingsFor). */
		ratings?: Ratings;
	} = $props();
</script>

{#snippet tile(entity: SchemaEntitySummary)}
	<EntityCard
		{entity}
		{showKind}
		{wall}
		{row}
		caption={caption?.(entity)}
		rating={ratings[entity.slug]}
	/>
{/snippet}

{#if wall}
	<!-- Стена картин: колонки собираются сами, холсты не переезжают при догрузке. -->
	<ArtWall items={entities} key={(entity) => entity.id} {tile} />
{:else}
	<ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
		{#each entities as entity (entity.id)}
			<li>{@render tile(entity)}</li>
		{/each}
	</ul>
{/if}
