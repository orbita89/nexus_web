<script lang="ts">
	import { count } from '#lib/catalog/labels.ts';
	import { THREAD_SORTS } from '#lib/social/forum.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import NewThreadButton from '#lib/components/social/NewThreadButton.svelte';
	import SortTabs from '#lib/components/social/SortTabs.svelte';
	import ThreadItem from '#lib/components/social/ThreadItem.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title="Форум"
	description="Обсуждения в Nexus: темы привязаны к произведениям — книгу и экранизацию можно сравнить в одной ветке."
/>

<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-3xl font-black sm:text-4xl">Форум</h1>
		<p class="mt-1 text-sm text-base-content/50">
			Темы привязаны к произведениям: книгу и её экранизации можно обсуждать в одной ветке.
		</p>
	</div>
	<NewThreadButton />
</header>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<SortTabs options={THREAD_SORTS} current={data.sort} fallback="active" label="Сортировка тем" />
	{#if data.threads.data}
		<span class="text-sm text-base-content/50"
			>{count(data.threads.data.total, ['тема', 'темы', 'тем'])}</span
		>
	{/if}
</div>

{#if data.threads.error}
	<LoadError message={data.threads.error} />
{:else if data.threads.data?.items.length}
	<ul class="flex max-w-4xl flex-col gap-3" aria-label="Темы">
		{#each data.threads.data.items as thread (thread.id)}
			<li><ThreadItem {thread} /></li>
		{/each}
	</ul>
	<Pagination
		total={data.threads.data.total}
		limit={data.threads.data.limit}
		offset={data.threads.data.offset}
	/>
{:else}
	<EmptyState title="Тем пока нет">Начните первую — о любимой книге и её экранизации.</EmptyState>
{/if}
