<script lang="ts">
	import type { SchemaCrop, SchemaFragment } from '#lib/api/generated/catalog.ts';
	import { cropStyle, iiifCrop, squareCrop, type Canvas } from '#lib/catalog/paintings.ts';
	import StripArrows from '#lib/components/catalog/StripArrows.svelte';

	// Лента «Интересные детали полотна»: крупный план куска картины и подпись. Фрагмент — не
	// отдельная картинка, а прямоугольник на холсте, поэтому карточка здесь не конец пути:
	// нажатие открывает сам холст, увеличенный на этом месте. Ради этого раздел и нужен —
	// иначе это была бы галерея обрезков рядом с картиной.
	let {
		fragments,
		canvas,
		/** Куда положить выбранный фрагмент: холст в шапке откроется на нём. */
		onopen
	}: {
		fragments: SchemaFragment[];
		canvas: Canvas;
		onopen: (crop: SchemaCrop) => void;
	} = $props();

	let track = $state<HTMLUListElement>();

	/** Квадрат вокруг фрагмента: карточки квадратные, а кроп — какой угодно. */
	const squares = $derived(
		fragments.map((fragment) => {
			const crop = squareCrop(fragment.crop, canvas);
			// Есть IIIF — просим у него готовый кусок: это один небольшой файл вместо холста
			// целиком. Нет — показываем исходник фоном, сдвинутым под окно карточки.
			return { fragment, crop, url: iiifCrop(canvas, crop) };
		})
	);
</script>

<section
	id="fragments"
	aria-labelledby="fragments-title"
	class="mb-14 scroll-mt-32 md:scroll-mt-28"
>
	<h2 id="fragments-title" class="mb-2 text-2xl font-bold">
		Интересные детали полотна
		<span class="font-semibold text-base-content/40">({fragments.length})</span>
	</h2>

	<div class="relative">
		<ul
			bind:this={track}
			class="scrollbar-hide -mx-1.5 flex snap-x scroll-px-1.5 gap-4 overflow-x-auto px-1.5 py-3"
			aria-label="Детали полотна"
		>
			{#each squares as { fragment, crop, url } (fragment.id)}
				<li class="w-56 shrink-0 snap-start sm:w-64">
					<button
						type="button"
						class="group h-full w-full overflow-hidden rounded-box bg-base-200 text-start ring-1 ring-base-content/5 transition hover:ring-primary/40"
						onclick={() => onopen(fragment.crop)}
					>
						<div
							class="relative w-full bg-base-300 bg-cover bg-no-repeat"
							style={url ? `background-image: url("${url}")` : cropStyle(canvas, crop)}
						>
							<!-- Квадрат держим отношением сторон, а не высотой: карточка сужается на
							     телефоне вместе с лентой. -->
							<div class="aspect-square"></div>
							<span
								class="absolute right-2 bottom-2 rounded-full bg-base-100/80 px-2 py-0.5 text-xs opacity-0 backdrop-blur-sm transition group-hover:opacity-100"
								>Показать на холсте</span
							>
						</div>
						<div class="p-3">
							<h3 class="text-sm font-semibold">{fragment.title}</h3>
							{#if fragment.description}
								<p class="mt-1 line-clamp-3 text-xs leading-relaxed text-base-content/60">
									{fragment.description}
								</p>
							{/if}
						</div>
					</button>
				</li>
			{/each}
		</ul>

		<StripArrows {track} label="Детали полотна" mediaSelector="li button > div" />
	</div>
</section>
