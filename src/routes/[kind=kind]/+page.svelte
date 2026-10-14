<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { hasFilters } from '#lib/catalog/filters.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { filterUrl } from '#lib/catalog/url.ts';
	import Alert from '#lib/components/Alert.svelte';
	import ArchiveResults from '#lib/components/catalog/ArchiveResults.svelte';
	import CatalogFilters from '#lib/components/catalog/CatalogFilters.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import { _ARCHIVE_PAGE } from './+page.ts';
	import type { PageProps } from './$types';

	// Раздел каталога: панель фильтров (CatalogFilters), порядок, выдача, «Из архива».
	let { data }: PageProps = $props();

	const filtered = $derived(hasFilters(data.filters));
	const tagName = $derived(data.tags.find((t) => t.slug === data.filters.tag)?.name);
	const heading = $derived(
		[data.kind.title, tagName, data.filters.year].filter(Boolean).join(' · ')
	);
	/** Идёт переход внутри раздела (новый фильтр, порядок, страница) — выдача в загрузке. */
	const loading = $derived(navigating.to?.url.pathname === page.url.pathname);
	const total = $derived(data.list.data?.total ?? 0);

	function sortBy(value: string) {
		const sort = value === data.mode.fallback ? null : value;
		goto(filterUrl(page.url, { sort }), { reset: false });
	}
</script>

<Seo
	title={heading}
	description="{data.kind.title} в каталоге Nexus{tagName
		? `: ${tagName}`
		: ''} — оценки, рецензии и обсуждения."
/>

<h1 class="mb-6 text-3xl font-black sm:text-4xl">{heading}</h1>

<CatalogFilters
	kind={data.kind}
	filters={data.filters}
	personName={data.personName}
	tags={data.tags}
/>

{#if data.personUnavailable}
	<div class="mb-4">
		<Alert kind="info">
			Фильтр по людям скоро заработает. Пока показаны фильмы по остальным фильтрам.
		</Alert>
	</div>
{/if}

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<p class="flex items-center gap-2 text-sm text-base-content/50" aria-live="polite">
		{#if loading}
			<span class="loading loading-xs loading-spinner"></span>Загружаем…
		{:else if data.list.data}
			{data.mode.search && total > data.list.data.limit ? 'Около ' : ''}{count(total, [
				'фильм',
				'фильма',
				'фильмов'
			])}
		{/if}
	</p>
	<label class="select w-auto select-sm">
		<span class="label">Сортировка</span>
		<select
			aria-label="Сортировка"
			value={data.mode.sort}
			onchange={(e) => sortBy(e.currentTarget.value)}
		>
			{#each data.mode.options as option (option.value)}
				<option value={option.value}>{option.title}</option>
			{/each}
		</select>
	</label>
</div>

<div
	class={['transition-opacity', { 'pointer-events-none opacity-40': loading }]}
	aria-busy={loading}
>
	{#if data.list.error}
		<LoadError message={data.list.error} />
	{:else if data.list.data && data.list.data.items.length}
		<EntityGrid entities={data.list.data.items} ratings={data.ratings} />
		<Pagination
			total={data.list.data.total}
			limit={data.list.data.limit}
			offset={data.list.data.offset}
		/>
	{:else if filtered}
		<EmptyState title="Фильмы не найдены">
			Попробуйте изменить параметры или <a href="/{data.kind.slug}" class="link link-primary"
				>сбросьте фильтры</a
			>.
		</EmptyState>
	{:else}
		<EmptyState title="Здесь пока пусто">
			В разделе «{data.kind.title}» ещё нет ни одного произведения.
		</EmptyState>
	{/if}

	{#if data.filters.archive && data.kind.kind === 'movie'}
		{#if !data.filters.q}
			<p class="mt-10 text-sm text-base-content/50">
				В архиве ищем только по названию — введите его в строку поиска.
			</p>
		{:else if data.archive?.data}
			{#key data.filters.q}
				<ArchiveResults q={data.filters.q} first={data.archive.data} pageSize={_ARCHIVE_PAGE} />
			{/key}
		{:else if data.archive?.error}
			<p class="mt-10 text-sm text-base-content/50">Архив сейчас недоступен.</p>
		{/if}
	{/if}
</div>
