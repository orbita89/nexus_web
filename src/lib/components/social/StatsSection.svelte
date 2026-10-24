<script lang="ts">
	import type { Snippet } from 'svelte';

	// Раздел «Статистики» со своим списком: заголовок, фильтры справа, «Показать ещё» и
	// состояния (скелетон, пусто, ошибка) — одинаково у оценок, отметок и комментариев.
	let {
		id,
		title,
		list,
		empty,
		filters,
		children
	}: {
		id: string;
		title: string;
		list: {
			items: readonly unknown[];
			total: number | null;
			loading: boolean;
			error: string;
			hasMore: boolean;
			more: () => void;
			retry: () => void;
		};
		/** Что написать, когда записей нет. */
		empty: string;
		filters?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section aria-labelledby="{id}-title" class="min-w-0">
	<div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
		<h3 id="{id}-title" class="text-xl font-bold">
			{title}
			{#if list.total !== null}
				<span class="ml-1 text-sm font-normal text-base-content/40 tabular-nums">{list.total}</span>
			{/if}
		</h3>
		{#if filters}{@render filters()}{/if}
	</div>

	{#if list.items.length}
		{@render children()}
		{#if list.hasMore}
			<button
				class="btn mt-4 btn-outline btn-sm"
				disabled={list.loading}
				onclick={() => list.more()}>Показать ещё</button
			>
		{/if}
	{:else if list.loading}
		<div class="h-24 skeleton" aria-label="Загрузка"></div>
	{:else if !list.error}
		<p class="text-base-content/50">{empty}</p>
	{/if}

	{#if list.error}
		<p role="alert" class="mt-3 text-sm text-error">
			{list.error}
			<button class="link" onclick={() => list.retry()}>Повторить</button>
		</p>
	{/if}
</section>
