<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { browserApi, liveQuery } from '#lib/social/card-live.svelte.ts';
	import PosterStrip from '#lib/components/catalog/PosterStrip.svelte';

	// Другие работы того же автора вместо (картины) или рядом с (книги) общими рекомендациями:
	// - картина: «Другие работы художника» — с холста уходят в соседний зал того же автора;
	// - книга: «Ещё книги автора» — только книги (kind=book), без экранизаций и прочего.
	//
	// Только в браузере, как и рекомендации: страница карточки остаётся статикой.
	let {
		slug,
		artist,
		role = 'artist',
		kind
	}: {
		/** Текущая работа: её саму в ленте не показываем. */
		slug: string;
		/** Автор (художник, писатель): по нему ищем остальные работы. */
		artist: { slug: string; name: string };
		/** Роль автора в работе: у картины `artist`, у книги `author`. */
		role?: 'artist' | 'author';
		/** Сузить выдачу до типа (у книги — `book`); без него — все работы автора. */
		kind?: 'book';
	} = $props();

	const isBook = $derived(role === 'author');
	const heading = $derived(isBook ? 'Ещё книги автора' : `Другие работы художника: ${artist.name}`);
	const linkLabel = $derived(isBook ? 'Все книги автора →' : 'Все работы автора →');

	const LIMIT = 12;
	/** Мест в скелетоне загрузки. */
	const PLACES = 6;

	const works = liveQuery(
		() => [artist.slug, role, kind] as const,
		async ([person, personRole, workKind]) =>
			(
				await unwrap(
					browserApi().catalog.GET('/api/v1/catalog/search', {
						params: {
							query: {
								person,
								role: personRole,
								sort: 'rating',
								limit: LIMIT,
								...(workKind ? { kind: [workKind] } : {})
							}
						}
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
			<h2 id="artist-works-title" class="text-2xl font-bold">{heading}</h2>
			<a href="/people/{artist.slug}" class="text-sm text-primary hover:underline">{linkLabel}</a>
		</div>
		{#if loading}
			<ul class="flex gap-4 overflow-hidden pt-1.5 pb-3" aria-hidden="true">
				{#each { length: PLACES }, i (i)}
					<li
						class={[
							'shrink-0 skeleton rounded-box',
							isBook ? 'aspect-[2/3] w-32 sm:w-40' : 'aspect-square w-40 sm:w-48 lg:w-56'
						]}
					></li>
				{/each}
			</ul>
		{:else}
			<!-- wide: у картины плитка квадратная, в постерной ширине она читается как марка. -->
			<PosterStrip entities={items} label={heading} wide={!isBook} />
		{/if}
	</section>
{/if}
