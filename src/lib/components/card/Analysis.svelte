<script lang="ts">
	import type { SchemaPaintingAnalysis } from '#lib/api/generated/catalog.ts';
	import Clamp from '#lib/components/catalog/Clamp.svelte';

	// «Смысл и анализ картины» — рядом с фактами, в боковой колонке. Отличается от «фактов» тем,
	// что это разбор: почему холст такой, а не перечень любопытных мелочей.
	//
	// Кнопки «Слушать разбор» здесь нет: озвучки у нас нет, а кнопка, за которой тишина, хуже,
	// чем её отсутствие.
	let { analysis }: { analysis: SchemaPaintingAnalysis } = $props();
</script>

<section
	aria-labelledby="analysis-title"
	class="rounded-box bg-base-200 p-5 text-sm ring-1 ring-base-content/5 sm:p-7"
>
	<!-- Микро-заголовок, как у соседних блоков боковой колонки: второй крупный h2 рядом с
	     заголовком раздела «О картине» читался как отдельный раздел. -->
	<h3
		id="analysis-title"
		class="mb-2 text-xs font-semibold tracking-widest text-base-content/50 uppercase"
	>
		Разбор картины
	</h3>

	<Clamp lines={6} class="text-sm leading-7 text-base-content/90">
		<p class="whitespace-pre-line">{analysis.text}</p>
	</Clamp>

	{#if analysis.points?.length}
		<!-- Тезисы — после текста: сначала общий разбор, потом «на что посмотреть». -->
		<ul class="mt-5 flex flex-col gap-4">
			{#each analysis.points as point (point.title)}
				<li class="border-l-2 border-primary/40 pl-3">
					<h3 class="text-sm font-semibold">{point.title}</h3>
					<p class="mt-1 text-sm leading-relaxed text-base-content/70">{point.text}</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>
