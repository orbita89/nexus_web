<script lang="ts">
	import { relatedGroups } from '#lib/catalog/card.ts';
	import PosterStrip from '#lib/components/catalog/PosterStrip.svelte';

	// Приквелы, сиквелы и ремейки — полосами постеров. Только непустые группы; нет ни одной — раздела
	// нет вовсе (у большинства произведений связей нет). Данные — из каталога (поле related в
	// карточке, см. relatedGroups), то есть в статическом HTML.
	let { entity }: { entity: object } = $props();

	const groups = $derived(relatedGroups(entity));
	// «Сиквелы», «Приквелы и сиквелы», «Приквелы, сиквелы и ремейки».
	const title = $derived.by(() => {
		const words = groups.map((g, i) => (i ? g.title.toLowerCase() : g.title));
		return words.length > 1 ? `${words.slice(0, -1).join(', ')} и ${words.at(-1)}` : words[0];
	});
</script>

{#if groups.length}
	<section aria-labelledby="related-title" class="mb-14">
		<h2 id="related-title" class="mb-4 text-2xl font-bold">
			{title}
		</h2>
		<div class="flex flex-col gap-6">
			{#each groups as group (group.key)}
				<div>
					{#if groups.length > 1}
						<h3 class="mb-2 text-xs font-semibold tracking-widest text-base-content/50 uppercase">
							{group.title}
						</h3>
					{/if}
					<PosterStrip entities={group.items} label={group.title} />
				</div>
			{/each}
		</div>
	</section>
{/if}
