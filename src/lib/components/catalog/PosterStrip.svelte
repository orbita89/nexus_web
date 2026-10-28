<script lang="ts">
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import type { Ratings } from '#lib/catalog/load.ts';
	import EntityCard from './EntityCard.svelte';

	let {
		entities,
		label,
		ratings = {},
		badges = {}
	}: {
		entities: SchemaEntitySummary[];
		label: string;
		ratings?: Ratings;
		/** Подпись над постером по id: «Сиквел», «Ремейк». */
		badges?: Record<string, string>;
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
			<li class="w-32 shrink-0 snap-start sm:w-36 lg:w-40">
				{#if badges[entity.id]}
					<span class="mb-1.5 badge badge-ghost badge-sm">{badges[entity.id]}</span>
				{/if}
				<EntityCard {entity} rating={ratings[entity.slug]} />
			</li>
		{/each}
	</ul>

	{#if scrollable && !atStart}
		<button
			type="button"
			class="absolute left-3 z-20 flex size-12 -translate-y-1/2 items-center justify-center rounded-xl border-0 bg-white/35 text-xl text-white transition hover:bg-white/50"
			style="top: {centerY}px"
			aria-label="Назад"
			onclick={() => scroll(-1)}>{`<`}</button
		>
	{/if}
	{#if scrollable && !atEnd}
		<button
			type="button"
			class="absolute right-3 z-20 flex size-12 -translate-y-1/2 items-center justify-center rounded-xl border-0 bg-white/35 text-xl text-white transition hover:bg-white/50"
			style="top: {centerY}px"
			aria-label="Вперёд"
			onclick={() => scroll(1)}>{`>`}</button
		>
	{/if}
</div>
