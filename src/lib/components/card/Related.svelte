<script lang="ts">
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import { relatedWorks } from '#lib/catalog/card.ts';
	import PosterStrip from '#lib/components/catalog/PosterStrip.svelte';

	// Приквелы, сиквелы и ремейки — одной каруселью по хронологии франшизы, у каждого постера —
	// подпись связи. Нет связей — раздела нет (у большинства произведений их нет). Данные — из
	// каталога (EntityDetail.related), то есть в статическом HTML.
	let { entity }: { entity: SchemaEntityDetail } = $props();

	const works = $derived(relatedWorks(entity));
	const badges = $derived(Object.fromEntries(works.map((w) => [w.item.id, w.label])));
</script>

{#if works.length}
	<section aria-labelledby="related-title" class="mb-14">
		<h2 id="related-title" class="mb-4 text-2xl font-bold">Связанные</h2>
		<PosterStrip entities={works.map((w) => w.item)} label="Связанные" {badges} />
	</section>
{/if}
