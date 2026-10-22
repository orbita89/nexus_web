<script lang="ts">
	import type { SchemaCollection, SchemaCollectionDetail } from '#lib/api/generated/social.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';
	import ShareMenu from '#lib/components/social/ShareMenu.svelte';

	// Конец страницы коллекции: «Далее» (первая из похожих) и ряд действий — поделиться,
	// обсуждение, все похожие. Обычные ссылки — перелинковка для SEO.
	let {
		collection,
		others = [],
		shareUrl,
		shareTitle
	}: {
		collection: SchemaCollectionDetail;
		others?: SchemaCollection[];
		shareUrl: string;
		shareTitle: string;
	} = $props();

	const base = $derived(buildFeaturedUrl(collection));
	// «Далее» — первая непустая из похожих (пустую подборку следующей не предлагаем).
	const next = $derived(others.find((o) => o.items_count > 0));
	const works = (n: number) => count(n, ['произведение', 'произведения', 'произведений']);
</script>

<!-- Одна строка: слева действия, справа «Далее» (на телефоне «Далее» сверху на всю ширину). -->
<footer
	class="mx-auto mt-10 flex max-w-4xl flex-col gap-4 border-t border-base-content/10 pt-8 sm:flex-row sm:items-center sm:justify-between"
>
	<div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
		<ShareMenu url={shareUrl} title={shareTitle} />
		<a href="{base}/discussion" class="btn gap-2 btn-ghost btn-sm">
			Обсуждение
			{#if collection.comments_count}
				<span class="text-base-content/50 tabular-nums">{collection.comments_count}</span>
			{/if}
		</a>
		{#if others.length}
			<a href="{base}/similar" class="btn gap-2 btn-ghost btn-sm">
				Похожие
				<span class="text-base-content/50 tabular-nums">{others.length}</span>
			</a>
		{/if}
	</div>
	{#if next}
		<a
			href={buildFeaturedUrl(next)}
			class="group order-first flex items-center justify-between gap-3 rounded-box px-3 py-2 ring-1 ring-base-content/10 transition-colors hover:ring-(--page-accent,var(--color-primary)) sm:order-none sm:justify-end sm:px-0 sm:py-0 sm:ring-0 sm:hover:ring-0"
			title="{next.title} · {works(next.items_count)}"
		>
			<span class="flex min-w-0 flex-col leading-tight sm:items-end">
				<span class="text-[0.65rem] tracking-wider text-base-content/50 uppercase">
					Далее · {works(next.items_count)}
				</span>
				<span
					class="max-w-[16rem] truncate text-sm font-semibold transition-colors group-hover:text-(--page-accent,var(--color-primary))"
				>
					{next.title}
				</span>
			</span>
			<span
				class="grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-base-content/20 transition-colors group-hover:bg-(--page-accent,var(--color-primary)) group-hover:text-base-100 group-hover:ring-transparent"
				aria-hidden="true">→</span
			>
		</a>
	{/if}
</footer>
