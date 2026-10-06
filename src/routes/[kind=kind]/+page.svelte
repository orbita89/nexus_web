<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { formUrl } from '#lib/catalog/url.ts';
	import { count } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tagName = $derived(data.tags.find((t) => t.slug === data.filters.tag)?.name);
	const filtered = $derived(!!(data.filters.q || data.filters.tag || data.filters.year));
	const heading = $derived(
		[data.kind.title, tagName, data.filters.year].filter(Boolean).join(' · ')
	);

	// Без JS форма уходит обычным GET; с JS — клиентская навигация без пустых полей в адресе.
	function submit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		goto(formUrl(page.url.pathname, new FormData(event.currentTarget)), { reset: false });
	}
</script>

<Seo
	title={heading}
	description="{data.kind.title} в каталоге Nexus{tagName
		? `: ${tagName}`
		: ''} — оценки, рецензии и обсуждения."
/>

<header class="mb-6">
	<h1 class="text-3xl font-black sm:text-4xl">{heading}</h1>
	{#if data.list.data}
		<p class="mt-1 text-sm text-base-content/50">
			{count(data.list.data.total, ['произведение', 'произведения', 'произведений'])}
		</p>
	{/if}
</header>

<form
	method="GET"
	action="/{data.kind.slug}"
	onsubmit={submit}
	class="mb-8 flex flex-wrap items-end gap-3 rounded-box bg-base-200 p-3 ring-1 ring-base-300"
	aria-label="Фильтры"
>
	<label class="input min-w-48 flex-1">
		<span class="sr-only">Название</span>
		<svg
			class="size-4 opacity-50"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
		>
		<input type="search" name="q" value={data.filters.q ?? ''} placeholder="Название" />
	</label>
	<label class="select w-full sm:w-56">
		<span class="sr-only">Тег</span>
		<select
			name="tag"
			value={data.filters.tag ?? ''}
			onchange={(e) => e.currentTarget.form?.requestSubmit()}
		>
			<option value="">Все теги</option>
			{#each data.tags as tag (tag.slug)}
				<option value={tag.slug}>{tag.name}</option>
			{/each}
		</select>
	</label>
	<label class="input w-32">
		<span class="sr-only">Год</span>
		<input
			type="number"
			name="year"
			value={data.filters.year ?? ''}
			min="1800"
			max="2100"
			placeholder="Год"
			inputmode="numeric"
		/>
	</label>
	<button class="btn btn-primary">Показать</button>
	{#if filtered}
		<a href="/{data.kind.slug}" class="btn btn-ghost">Сбросить</a>
	{/if}
</form>

{#if data.list.error}
	<LoadError message={data.list.error} />
{:else if data.list.data && data.list.data.items.length}
	<EntityGrid entities={data.list.data.items} />
	<Pagination
		total={data.list.data.total}
		limit={data.list.data.limit}
		offset={data.list.data.offset}
	/>
{:else}
	<EmptyState title={filtered ? 'Ничего не нашлось' : 'Здесь пока пусто'}>
		{#if filtered}
			Попробуйте другие фильтры или <a href="/{data.kind.slug}" class="link link-primary"
				>сбросьте их</a
			>.
		{:else}
			В разделе «{data.kind.title}» ещё нет ни одного произведения.
		{/if}
	</EmptyState>
{/if}
