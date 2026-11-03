<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import type { Ratings } from '#lib/catalog/load.ts';
	import EntityCard from './EntityCard.svelte';

	let {
		entities,
		label,
		ratings = {},
		badges = {},
		wide = false
	}: {
		entities: SchemaEntitySummary[];
		label: string;
		ratings?: Ratings;
		/** Подпись над постером по id: «Сиквел», «Ремейк». */
		badges?: Record<string, string>;
		/** Широкие карточки: квадратная плитка картины в постерной ширине читается как марка. */
		wide?: boolean;
	} = $props();

	let box = $state<HTMLDivElement | undefined>(undefined);
	let track = $state<HTMLUListElement | undefined>(undefined);
	let atStart = $state(true);
	let atEnd = $state(false);
	/** Лента шире экрана — только тогда кнопки вообще нужны. */
	let scrollable = $state(false);
	/** Центр постера от верха полосы: подписи под ним не должны сдвигать кнопки вниз. */
	let centerY = $state(0);

	/** Сколько карточек листаем за один клик — чем больше, тем чувствительнее скролл. */
	const STEP_CARDS = 2;

	/** Прокрутка ленты вперёд/назад на несколько карточек за раз. */
	function scroll(direction: -1 | 1) {
		if (!track) return;
		const first = track.querySelector('li') as HTMLElement | undefined;
		const cardStep = first ? first.offsetWidth + 16 : track.clientWidth / STEP_CARDS; // 16px = gap-4
		const step = STEP_CARDS * cardStep;
		track.scrollBy({ left: direction * step, behavior: 'smooth' });
	}

	/** Края ленты, нужны ли кнопки и куда их ставить по вертикали. */
	$effect(() => {
		const el = track;
		if (!el) return;
		const update = () => {
			atStart = el.scrollLeft <= 8;
			atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
			scrollable = el.scrollWidth > el.clientWidth + 2;
			const poster = el.querySelector('li a > div') as HTMLElement | null;
			if (poster && box) {
				const card = poster.getBoundingClientRect();
				centerY = card.top - box.getBoundingClientRect().top + card.height / 2;
			}
		};
		el.addEventListener('scroll', update, { passive: true });
		const observer = new ResizeObserver(update);
		observer.observe(el);
		update();
		return () => {
			el.removeEventListener('scroll', update);
			observer.disconnect();
		};
	});
</script>

<!-- Полоса постеров: на телефоне листается пальцем, на десктопе — колёсом, тачпадом или кнопками < >. -->
<div class="relative" bind:this={box}>
	<!-- Боковые отступы внутри ленты: иначе обводка карточки по краю обрезается прокруткой. -->
	<ul
		bind:this={track}
		class="scrollbar-hide -mx-1.5 flex snap-x scroll-px-1.5 gap-4 overflow-x-auto px-1.5 py-3"
		aria-label={label}
	>
		{#each entities as entity (entity.id)}
			<li class={['shrink-0 snap-start', wide ? 'w-40 sm:w-48 lg:w-56' : 'w-32 sm:w-36 lg:w-40']}>
				{#if badges[entity.id]}
					<span class="mb-1.5 badge badge-ghost badge-sm">{badges[entity.id]}</span>
				{/if}
				<EntityCard {entity} rating={ratings[entity.slug]} />
			</li>
		{/each}
	</ul>

	<!-- Кнопки не лежат на постере: у края лента гаснет в фон, кнопка стоит в этом затухании
	     и наполовину вынесена за ленту. Затухание — только там, где есть куда листать. -->
	{#if scrollable && !atStart}
		<div
			class="pointer-events-none absolute inset-y-3 left-0 z-10 w-24 bg-linear-to-r from-base-100 via-base-100/85 to-transparent"
		></div>
		<button
			type="button"
			class="absolute -left-2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-base-100/90 text-lg shadow-lg ring-1 ring-base-content/10 transition hover:bg-base-100 hover:text-primary hover:ring-primary/50"
			style="top: {centerY}px"
			aria-label="Назад"
			onclick={() => scroll(-1)}>&lt;</button
		>
	{/if}
	{#if scrollable && !atEnd}
		<div
			class="pointer-events-none absolute inset-y-3 right-0 z-10 w-24 bg-linear-to-l from-base-100 via-base-100/85 to-transparent"
		></div>
		<button
			type="button"
			class="absolute -right-2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-base-100/90 text-lg shadow-lg ring-1 ring-base-content/10 transition hover:bg-base-100 hover:text-primary hover:ring-primary/50"
			style="top: {centerY}px"
			aria-label="Вперёд"
			onclick={() => scroll(1)}>&gt;</button
		>
	{/if}
</div>
