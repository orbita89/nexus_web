<script lang="ts">
	import type { SchemaFragment } from '#lib/api/generated/catalog.ts';
	import { cropStyle, iiifCrop, squareCrop, type Canvas } from '#lib/catalog/paintings.ts';
	import StripArrows from '#lib/components/catalog/StripArrows.svelte';

	// Лента «Интересные детали полотна»: крупный план куска картины и подпись. Фрагмент — не
	// отдельная картинка, а прямоугольник на холсте, поэтому карточка здесь не конец пути:
	// нажатие открывает сам холст, увеличенный на этом месте. Ради этого раздел и нужен —
	// иначе это была бы галерея обрезков рядом с картиной.
	let {
		fragments,
		canvas,
		/** Куда положить выбранный фрагмент: холст в шапке откроется на нём, с его подписью. */
		onopen
	}: {
		fragments: SchemaFragment[];
		canvas: Canvas;
		onopen: (fragment: SchemaFragment) => void;
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
	<h2 id="fragments-title" class="mb-4 text-2xl font-bold">
		Интересные детали полотна
		<span class="text-sm font-normal text-base-content/40">({fragments.length})</span>
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
						class="group h-full w-full overflow-hidden rounded-box bg-base-200 text-start ring-1 ring-base-content/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:shadow-primary/20 hover:ring-primary"
						onclick={() => onopen(fragment)}
					>
						<div
							class="relative w-full bg-base-300 bg-cover bg-no-repeat"
							style={url ? `background-image: url("${url}")` : cropStyle(canvas, crop)}
						>
							<!-- Квадрат держим отношением сторон, а не высотой: карточка сужается на
							     телефоне вместе с лентой. -->
							<div class="aspect-square"></div>
							<!-- Значок виден всегда, а не по наведению: на телефоне ховера нет, и
							     подсказки о том, что карточка ведёт на холст, не было вовсе. -->
							<span
								class="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-base-100/75 px-2.5 py-1 text-xs opacity-90 ring-1 ring-white/10 backdrop-blur-sm transition group-hover:bg-base-100 group-hover:opacity-100"
							>
								<svg
									class="size-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<circle cx="11" cy="11" r="7" />
									<path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
								</svg>
								На холсте
							</span>
						</div>
						<!-- Высота текста фиксирована: заголовок бывает в одну и в две строки, и без
						     этого нижний край ленты получался рваным. -->
						<div class="flex min-h-24 flex-col p-4">
							<h3 class="line-clamp-2 text-sm leading-snug font-semibold">{fragment.title}</h3>
							{#if fragment.description}
								<!-- Две строки вместо трёх: это зацепка, а не чтение. Целиком описание
								     читается в просмотрщике, рядом с самой деталью. -->
								<p class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-base-content/70">
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
