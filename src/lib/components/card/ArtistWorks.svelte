<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { browserApi, liveQuery } from '#lib/social/card-live.svelte.ts';
	import PosterStrip from '#lib/components/catalog/PosterStrip.svelte';

	// «Другие работы художника» вместо общих рекомендаций: с холста уходят не к похожей картине
	// вообще, а к соседней работе того же автора — так смотрят залы в музее.
	//
	// Только в браузере, как и рекомендации: страница карточки остаётся статикой.
	let {
		slug,
		artist
	}: {
		/** Текущая картина: её саму в ленте не показываем. */
		slug: string;
		artist: { slug: string; name: string };
	} = $props();

	const LIMIT = 12;
	/** Мест в скелетоне загрузки. */
	const PLACES = 6;

	const works = liveQuery(
		() => artist.slug,
		async (person) =>
			(
				await unwrap(
					browserApi().catalog.GET('/api/v1/catalog/search', {
						params: { query: { person, role: 'artist', sort: 'rating', limit: LIMIT } }
					})
				)
			).items
	);
	const items = $derived((works.current?.data ?? []).filter((item) => item.slug !== slug));
	const loading = $derived(!works.current);
</script>

{#if loading || items.length}
	<section
		id="artist-works"
		aria-labelledby="artist-works-title"
		class="mb-14 scroll-mt-32 md:scroll-mt-28"
	>
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
			<h2 id="artist-works-title" class="text-2xl font-bold">
				Другие работы художника: {artist.name}
			</h2>
			<a href="/people/{artist.slug}" class="text-sm text-primary hover:underline"
				>Все работы автора →</a
			>
		</div>
		{#if loading}
			<ul class="flex gap-4 overflow-hidden pt-1.5 pb-3" aria-hidden="true">
				{#each { length: PLACES }, i (i)}
					<li class="aspect-square w-40 shrink-0 skeleton rounded-box sm:w-48 lg:w-56"></li>
				{/each}
			</ul>
		{:else}
			<!-- wide: у картины плитка квадратная, в постерной ширине она читается как марка. -->
			<PosterStrip entities={items} label="Другие работы художника" wide />
		{/if}
	</section>
{/if}
