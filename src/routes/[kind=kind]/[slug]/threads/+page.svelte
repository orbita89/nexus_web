<script lang="ts">
	import { entityHref } from '#lib/catalog/kinds.ts';
	import { count, yearOf } from '#lib/catalog/labels.ts';
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

	const entity = $derived(data.entity);
	const year = $derived(yearOf(entity.release_date));
	const name = $derived(`${entity.title}${year ? ` (${year})` : ''}`);
</script>

<Seo title="Обсуждения: {name}" description="Темы форума Nexus о «{name}»." />

<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<a href={entityHref(entity)} class="link text-sm text-primary link-hover">← {name}</a>
		<h1 class="mt-1 text-3xl font-black sm:text-4xl">Обсуждения: {entity.title}</h1>
		{#if data.threads.data}
			<p class="mt-1 text-sm text-base-content/50">
				{count(data.threads.data.total, ['тема', 'темы', 'тем'])}
			</p>
		{/if}
	</div>
	<NewThreadButton entity={entity.slug} label="Начать обсуждение" />
</header>

{#if data.threads.error}
	<LoadError message={data.threads.error} />
{:else if data.threads.data?.items.length}
	<div class="mb-4">
		<SortTabs options={THREAD_SORTS} current={data.sort} fallback="active" label="Сортировка тем" />
	</div>
	<ul class="flex max-w-4xl flex-col gap-3" aria-label="Обсуждения">
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
	<EmptyState title="Обсуждений пока нет">Начните первое — кнопка выше.</EmptyState>
{/if}
