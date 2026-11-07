<script lang="ts">
	import { onMount } from 'svelte';
	import type { SchemaEpisode } from '#lib/api/generated/catalog.ts';
	import {
		episodesCount,
		episodeMeta,
		episodeReleased,
		episodeTitle,
		stillRatio
	} from '#lib/catalog/seasons.ts';
	import StripArrows from '#lib/components/catalog/StripArrows.svelte';

	// Лента серий сезона: кадр 16:9, номер с названием, дата и длительность. Карточка ничего не
	// открывает и ничего не проигрывает — видео у нас нет, и «просмотрено» с прогрессом здесь не
	// будет. Серия не сущность: своей страницы, оценки и рецензий у неё нет.
	let {
		episodes,
		/** Постер сезона (иначе сериала) — заглушка там, где кадра нет. */
		fallbackCover = null
	}: {
		episodes: SchemaEpisode[];
		fallbackCover?: string | null;
	} = $props();

	let track = $state<HTMLUListElement>();

	// Вышла ли серия — по часам зрителя, а не сборки: страница статическая и живёт дольше дня
	// премьеры. До гидрации считаем вышедшими всё, что с датой в прошлом на момент сборки.
	let today = $state(new Date().toISOString().slice(0, 10));
	onMount(() => (today = new Date().toISOString().slice(0, 10)));
</script>

<section id="episodes" aria-labelledby="episodes-title" class="mb-14 scroll-mt-32 md:scroll-mt-28">
	<h2 id="episodes-title" class="mb-2 text-2xl font-bold">
		Серии <span class="font-semibold text-base-content/40">({episodes.length})</span>
	</h2>

	<!-- Листание — теми же кнопками, что у полос постеров по всему сайту. -->
	<div class="relative">
		<ul
			bind:this={track}
			class="scrollbar-hide -mx-1.5 flex snap-x scroll-px-1.5 gap-4 overflow-x-auto px-1.5 py-3"
			aria-label="Серии сезона: {episodesCount(episodes.length)}"
		>
			{#each episodes as episode (episode.id)}
				{@const released = episodeReleased(episode, today)}
				{@const still = episode.still_url ?? fallbackCover}
				<li class="w-64 shrink-0 snap-start sm:w-72">
					<article
						class={[
							'h-full overflow-hidden rounded-box bg-base-200 ring-1 ring-base-content/5 transition',
							released ? 'hover:ring-primary/40' : 'opacity-60'
						]}
					>
						<div
							class="relative w-full overflow-hidden bg-base-300"
							style="aspect-ratio: {stillRatio(episode)}"
						>
							{#if still}
								<img
									src={still}
									alt=""
									loading="lazy"
									decoding="async"
									class={[
										'h-full w-full',
										// Кадр снят в тех же пропорциях — он ложится ровно; заглушка-постер
										// вертикальная, и её вписываем целиком, чтобы не срезать лица.
										episode.still_url ? 'object-cover' : 'object-contain p-2 opacity-70'
									]}
								/>
							{:else}
								<span
									class="flex h-full w-full items-center justify-center text-3xl font-black text-base-content/20"
									>{episode.number}</span
								>
							{/if}
							{#if !released}
								<!-- Серия ещё не вышла: это важнее даты мелким шрифтом под названием. -->
								<span class="absolute top-2 left-2 badge badge-sm badge-neutral">Скоро</span>
							{/if}
						</div>

						<div class="p-3">
							<h3 class="line-clamp-2 text-sm font-semibold">{episodeTitle(episode)}</h3>
							<p class="mt-1 text-xs text-base-content/50">{episodeMeta(episode).join(' · ')}</p>
						</div>
					</article>
				</li>
			{/each}
		</ul>

		<StripArrows {track} label="Серии" mediaSelector="li article > div" />
	</div>
</section>
