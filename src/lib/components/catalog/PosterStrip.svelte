<script lang="ts">
	import type { Ratings } from '#lib/catalog/load.ts';
	import EntityCard, { type CardEntity } from './EntityCard.svelte';
	import StripArrows from './StripArrows.svelte';

	let {
		entities,
		label,
		ratings = {},
		badges = {},
		wide = false,
		showKind = false
	}: {
		entities: CardEntity[];
		label: string;
		ratings?: Ratings;
		/** Подпись над постером по id: «Сиквел», «Ремейк». */
		badges?: Record<string, string>;
		/** Широкие карточки: квадратная плитка картины в постерной ширине читается как марка. */
		wide?: boolean;
		/** Подписать раздел: в общей ленте книга и фильм идут вперемешку. */
		showKind?: boolean;
	} = $props();

	let track = $state<HTMLUListElement | undefined>(undefined);
</script>

<!-- Полоса постеров: на телефоне листается пальцем, на десктопе — колёсом, тачпадом или кнопками < >. -->
<div class="relative">
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
				<EntityCard {entity} rating={ratings[entity.slug]} {showKind} />
			</li>
		{/each}
	</ul>

	<StripArrows {track} {label} />
</div>
