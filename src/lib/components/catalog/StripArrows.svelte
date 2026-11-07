<script lang="ts">
	// Кнопки листания ленты — одни и те же у полосы постеров и у ленты серий. Кнопка не лежит на
	// карточке: у края лента гаснет в фон, кнопка стоит в этом затухании и наполовину вынесена за
	// ленту. Затухание — только там, где есть куда листать.
	//
	// По вертикали кнопка встаёт в середину картинки, а не всей карточки: подписи под постером
	// или под названием серии не должны сдвигать её вниз.
	let {
		track,
		label = 'Листать',
		/** Картинка карточки: по ней считается середина, на которой стоят кнопки. */
		mediaSelector = 'li a > div',
		/** Сколько карточек листаем за один клик — чем больше, тем чувствительнее скролл. */
		step = 2
	}: {
		track?: HTMLElement;
		label?: string;
		mediaSelector?: string;
		step?: number;
	} = $props();

	let box = $state<HTMLDivElement>();
	let atStart = $state(true);
	let atEnd = $state(false);
	/** Лента шире экрана — только тогда кнопки вообще нужны. */
	let scrollable = $state(false);
	/** Центр картинки от верха полосы. */
	let centerY = $state(0);

	function scroll(direction: -1 | 1) {
		if (!track) return;
		const first = track.querySelector('li') as HTMLElement | null;
		const cardStep = first ? first.offsetWidth + 16 : track.clientWidth / step; // 16px = gap-4
		track.scrollBy({ left: direction * step * cardStep, behavior: 'smooth' });
	}

	/** Края ленты, нужны ли кнопки и куда их ставить по вертикали. */
	$effect(() => {
		const el = track;
		if (!el) return;
		const update = () => {
			atStart = el.scrollLeft <= 8;
			atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
			scrollable = el.scrollWidth > el.clientWidth + 2;
			const media = el.querySelector(mediaSelector) as HTMLElement | null;
			if (media && box) {
				const card = media.getBoundingClientRect();
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

<!-- Пустой слой поверх ленты: сама лента лежит в том же relative-контейнере, что и этот блок. -->
<div bind:this={box} class="pointer-events-none absolute inset-0">
	{#if scrollable && !atStart}
		<div
			class="absolute inset-y-3 left-0 z-10 w-24 bg-linear-to-r from-base-100 via-base-100/85 to-transparent"
		></div>
		<button
			type="button"
			class="pointer-events-auto absolute -left-2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-base-100/90 text-lg shadow-lg ring-1 ring-base-content/10 transition hover:bg-base-100 hover:text-primary hover:ring-primary/50"
			style="top: {centerY}px"
			aria-label="{label}: назад"
			onclick={() => scroll(-1)}>&lt;</button
		>
	{/if}
	{#if scrollable && !atEnd}
		<div
			class="absolute inset-y-3 right-0 z-10 w-24 bg-linear-to-l from-base-100 via-base-100/85 to-transparent"
		></div>
		<button
			type="button"
			class="pointer-events-auto absolute -right-2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-base-100/90 text-lg shadow-lg ring-1 ring-base-content/10 transition hover:bg-base-100 hover:text-primary hover:ring-primary/50"
			style="top: {centerY}px"
			aria-label="{label}: вперёд"
			onclick={() => scroll(1)}>&gt;</button
		>
	{/if}
</div>
