<script lang="ts">
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { kindByApi } from '#lib/catalog/kinds.ts';
	import { tagCount, type TagEntry } from '#lib/catalog/tags.ts';

	// Жанр — это вход в каталог, а не метка: ему нужен размер, описание и раздел, к которому он
	// относится. «Боевик» и «бытовой жанр» одинаковыми чипами не различить — поэтому плитки.
	let {
		tiles,
		label = 'Жанры'
	}: {
		/** Жанр и раздел, из которого он сюда попал: от раздела — счётчик и цвет плитки. */
		tiles: { tag: TagEntry; kind?: SchemaEntityKind }[];
		label?: string;
	} = $props();

	// Сетка подстраивается под число плиток: половина пустой строки читается как недогруз,
	// поэтому колонок столько, чтобы строки вышли полными, а хвост не показываем.
	const cols = $derived(tiles.length % 4 === 0 ? 4 : 3);
	const shown = $derived(tiles.slice(0, Math.floor(tiles.length / cols) * cols));

	/** Цвет раздела — тот же, что у заглушки обложки: фильмы оранжевые, картины тёплые. */
	const TINT: Record<SchemaEntityKind, string> = {
		movie: 'from-primary/25',
		series: 'from-secondary/25',
		book: 'from-accent/20',
		game: 'from-info/20',
		painting: 'from-warning/20'
	};
</script>

<ul
	class={['grid gap-3 sm:grid-cols-2', cols === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3']}
	aria-label={label}
>
	{#each shown as { tag, kind } (tag.slug + (kind ?? ''))}
		<li>
			<a
				href={kind ? `/tags/${tag.slug}?kind=${kindByApi(kind).slug}` : `/tags/${tag.slug}`}
				class={[
					'group flex h-full flex-col gap-1 rounded-box bg-linear-to-br via-base-200 to-base-200 p-4 ring-1 ring-base-300 transition hover:-translate-y-0.5 hover:ring-primary',
					kind ? TINT[kind] : 'from-base-300'
				]}
			>
				{#if kind}
					<span class="text-[0.65rem] font-semibold tracking-widest text-base-content/40 uppercase"
						>{kindByApi(kind).title}</span
					>
				{/if}
				<span class="text-lg leading-tight font-bold group-hover:text-primary">{tag.name}</span>
				{#if tag.description}
					<span class="line-clamp-2 text-xs text-base-content/50">{tag.description}</span>
				{/if}
				<span class="mt-auto pt-2 text-xs text-base-content/40">{tagCount(tag, kind)}</span>
			</a>
		</li>
	{/each}
</ul>
