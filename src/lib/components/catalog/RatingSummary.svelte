<script lang="ts">
	import type { SchemaRatingSummary } from '#lib/api/generated/social.ts';
	import { count } from '#lib/catalog/labels.ts';

	let { rating }: { rating: SchemaRatingSummary } = $props();

	// Высота столбика — доля от самого частого значения, шагом 10%. Классы перечислены целиком,
	// чтобы Tailwind их нашёл (своего CSS и style="" нет).
	const HEIGHTS = [
		'h-0',
		'h-[10%]',
		'h-[20%]',
		'h-[30%]',
		'h-[40%]',
		'h-[50%]',
		'h-[60%]',
		'h-[70%]',
		'h-[80%]',
		'h-[90%]',
		'h-full'
	];
	const max = $derived(Math.max(1, ...rating.distribution));
	const height = (n: number) =>
		n === 0 ? HEIGHTS[0] : HEIGHTS[Math.max(1, Math.round((n / max) * 10))];
</script>

<section aria-labelledby="rating-title" class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
	<h2
		id="rating-title"
		class="text-xs font-semibold tracking-widest text-base-content/50 uppercase"
	>
		Оценка Nexus
	</h2>
	{#if rating.count === 0 || rating.average == null}
		<p class="mt-2 text-sm text-base-content/60">Оценок пока нет.</p>
	{:else}
		<div class="mt-2 flex items-end gap-5">
			<div class="shrink-0">
				<p class="text-5xl leading-none font-black text-primary">
					{rating.average.toLocaleString('ru-RU', { minimumFractionDigits: 1 })}<span
						class="text-base font-semibold text-base-content/40">/10</span
					>
				</p>
				<p class="mt-1 text-sm text-base-content/60">
					{count(rating.count, ['оценка', 'оценки', 'оценок'])}
				</p>
			</div>
			<ol class="flex h-20 flex-1 items-stretch gap-1" aria-label="Распределение оценок">
				{#each rating.distribution as n, i (i)}
					<li class="flex flex-1 flex-col items-center gap-1" title="{i + 1}: {n}">
						<span class="sr-only">Оценка {i + 1}: {n}</span>
						<span class="flex w-full flex-1 items-end" aria-hidden="true">
							<span
								class={[
									'block w-full rounded-t-sm',
									height(n),
									n === 0 ? 'min-h-0.5 bg-base-300' : 'min-h-1 bg-primary/80'
								]}
							></span>
						</span>
						<span class="text-[0.6rem] leading-none text-base-content/40" aria-hidden="true"
							>{i + 1}</span
						>
					</li>
				{/each}
			</ol>
		</div>
	{/if}
</section>
