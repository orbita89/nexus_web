<script lang="ts">
	import type { SchemaPaintingAnalysis } from '#lib/api/generated/catalog.ts';

	// «Смысл и анализ картины» — отдельный раздел во всю ширину, а не колонка сбоку. В колонке
	// 20rem связный текст ломался на четыре слова в строке и тянул её вниз на два экрана ниже
	// таблицы фактов — слева оставалась пустота во весь разворот.
	//
	// Кнопки «Слушать разбор» здесь нет: озвучки у нас нет, а кнопка, за которой тишина, хуже,
	// чем её отсутствие.
	let { analysis }: { analysis: SchemaPaintingAnalysis } = $props();

	/** Абзацы: пустая строка в тексте — граница абзаца, а не строка с многоточием. */
	const paragraphs = $derived(
		analysis.text
			.split(/\n{2,}/)
			.map((p) => p.trim())
			.filter(Boolean)
	);
</script>

<section id="analysis" aria-labelledby="analysis-title" class="mb-14 scroll-mt-32 md:scroll-mt-28">
	<h2 id="analysis-title" class="mb-4 text-2xl font-bold">Смысл и анализ картины</h2>

	<!-- Две колонки: слева разбор, справа тезисы. Текст держит читаемую строку в 70–80 знаков, и
	     во всю ширину плашки его не растянуть — справа оставалась дыра в пол-экрана. Тезисы
	     короткие, в узкой колонке им хорошо, и плашка заканчивается там же, где текст. -->
	<div
		class="grid gap-6 rounded-box bg-base-200 p-5 ring-1 ring-base-content/5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10"
	>
		<!-- Абзацы отдельными <p>, и текст целиком, без «Читать далее». Свёрнутый до шести строк
		     разбор прятал половину себя и обрывался на пустой строке между абзацами — многоточие
		     вместо мысли. Ради этого текста на раздел и заходят, прятать его незачем. -->
		<div class="text-base leading-8 text-base-content/90">
			{#each paragraphs as paragraph, i (i)}
				<p class={i ? 'mt-4' : ''}>{paragraph}</p>
			{/each}
		</div>

		{#if analysis.points?.length}
			<!-- На узком экране тезисы идут под текстом в два столбца, на широком — одним столбцом
			     сбоку, отчёркнутые от разбора. -->
			<ul
				class="grid gap-3 self-start sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-base-content/10 lg:pl-8"
			>
				{#each analysis.points as point (point.title)}
					<li>
						<h3 class="text-sm font-semibold">{point.title}</h3>
						<p class="mt-1 text-sm leading-relaxed text-base-content/70">{point.text}</p>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
