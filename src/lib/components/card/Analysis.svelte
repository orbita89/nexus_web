<script lang="ts">
	import type { SchemaPaintingAnalysis } from '#lib/api/generated/catalog.ts';
	import Clamp from '#lib/components/catalog/Clamp.svelte';

	// «Смысл и анализ картины» — отдельный раздел во всю ширину, а не колонка сбоку. В колонке
	// 20rem связный текст ломался на четыре слова в строке и тянул её вниз на два экрана ниже
	// таблицы фактов — слева оставалась пустота во весь разворот.
	//
	// Кнопки «Слушать разбор» здесь нет: озвучки у нас нет, а кнопка, за которой тишина, хуже,
	// чем её отсутствие.
	let { analysis }: { analysis: SchemaPaintingAnalysis } = $props();
</script>

<section id="analysis" aria-labelledby="analysis-title" class="mb-14 scroll-mt-32 md:scroll-mt-28">
	<h2 id="analysis-title" class="mb-4 text-2xl font-bold">Смысл и анализ картины</h2>

	<div class="rounded-box bg-base-200 p-5 ring-1 ring-base-content/5 sm:p-7">
		<!-- Строка в 70–80 знаков: читать длинный текст во всю ширину экрана невозможно. -->
		<Clamp lines={6} class="max-w-3xl text-base leading-8 text-base-content/90">
			<p class="whitespace-pre-line">{analysis.text}</p>
		</Clamp>

		{#if analysis.points?.length}
			<!-- Тезисы — карточками в ряд: это список «на что посмотреть», и в строку они читаются
			     как подписи у экспонатов, а не как продолжение текста. -->
			<ul class="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each analysis.points as point (point.title)}
					<li class="rounded-box bg-base-100/60 p-4 ring-1 ring-base-content/5">
						<h3 class="text-sm font-semibold">{point.title}</h3>
						<p class="mt-1.5 text-sm leading-relaxed text-base-content/70">{point.text}</p>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
