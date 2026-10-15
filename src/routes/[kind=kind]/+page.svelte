<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { ARCHIVE_PAGE, archiveFeed } from '#lib/catalog/archive.svelte.ts';
	import { hasFilters, readArchive, yearLabel } from '#lib/catalog/filters.ts';
	import { ARCHIVE_ALL, foundLabel, sectionPage } from '#lib/catalog/search.ts';
	import { filterUrl } from '#lib/catalog/url.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import CatalogFilters from '#lib/components/catalog/CatalogFilters.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import ResultsFeed from '#lib/components/catalog/ResultsFeed.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	// Раздел каталога: панель фильтров (CatalogFilters), порядок и одна выдача (ResultsFeed): фильмы
	// сайта, за ними — из архива; «Показать ещё» дописывает карточки.
	let { data }: PageProps = $props();

	const filtered = $derived(hasFilters(data.filters));
	const tagName = $derived(data.tags.find((t) => t.slug === data.filters.tag)?.name);
	const heading = $derived(
		[data.kind.title, tagName, yearLabel(data.filters)].filter(Boolean).join(' · ')
	);
	/** Идёт переход внутри раздела (новый фильтр, порядок, страница) — выдача в загрузке. */
	const loading = $derived(navigating.to?.url.pathname === page.url.pathname);
	const total = $derived(data.list.data?.total ?? 0);
	/**
	 * Архив (archive=1, только у фильмов): по названию или, без названия и фильтров, весь (по тегу и
	 * году архив не ищет). Весь считается ~2 с — пока считается, «считаем архив…».
	 */
	const archiveOn = $derived(data.kind.kind === 'movie' && readArchive(page.url));
	const feed = archiveFeed(() =>
		!archiveOn ? null : data.filters.q ? data.filters.q : filtered ? null : ARCHIVE_ALL
	);
	const archive = $derived(feed.archive);
	const archiveTotal = $derived(archive?.first.total ?? 0);

	const more = (offset: number) =>
		sectionPage(guestApi, data.kind.kind, data.filters, data.mode, offset).then((r) => r.page);

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
	path="/{data.kind.slug}"
	filters={data.filters}
	archive={archiveOn}
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
			{foundLabel(total, ['фильм', 'фильма', 'фильмов'], {
				text: data.mode.text,
				limit: data.list.data.limit,
				extra: archiveTotal
			})}
			{#if feed.loading}
				<span class="loading loading-xs loading-spinner"></span>
				{data.filters.q ? 'ищем в архиве…' : 'считаем архив…'}
			{:else if archiveOn && filtered && !data.filters.q}
				· архив ищется только по названию
			{/if}
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
	{:else if data.list.data && (data.list.data.items.length || archive?.first.items.length)}
		<ResultsFeed
			first={data.list.data}
			{more}
			ratings={data.ratings}
			{archive}
			archivePage={ARCHIVE_PAGE}
		/>
	{:else if feed.loading}
		<p class="flex items-center gap-2 py-10 text-sm text-base-content/50" role="status">
			<span class="loading loading-sm loading-spinner"></span>Ищем в архиве…
		</p>
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

	{#if data.kind.kind === 'movie' && data.filters.q && !archiveOn && !data.list.data?.items.length}
		<p class="mt-6 text-sm text-base-content/60">
			Возможно, фильм есть в архиве —
			<a href={filterUrl(page.url, { archive: '1' })} class="link link-primary">поискать в архиве</a
			>.
		</p>
	{/if}
</div>
