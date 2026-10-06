<script lang="ts">
	import { count } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import KindTabs from '#lib/components/catalog/KindTabs.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const heading = $derived(data.kind ? `${data.tag.name} · ${data.kind.title}` : data.tag.name);
</script>

<Seo
	title={heading}
	description="{data.tag.name}: {data.kind
		? data.kind.title.toLowerCase()
		: 'фильмы, сериалы, книги и игры'} в каталоге Nexus."
/>

<header class="mb-6">
	<a href="/tags" class="link text-sm text-primary link-hover">Теги</a>
	<h1 class="mt-1 text-3xl font-black sm:text-4xl">{data.tag.name}</h1>
	<p class="mt-1 text-sm text-base-content/50">
		{count(data.tag.entities_count, ['произведение', 'произведения', 'произведений'])} в каталоге
	</p>
</header>

<div class="mb-8 overflow-x-auto"><KindTabs current={data.kind?.slug} /></div>

{#if data.list.error}
	<LoadError message={data.list.error} />
{:else if data.list.data?.items.length}
	<EntityGrid entities={data.list.data.items} showKind={!data.kind} />
	<Pagination
		total={data.list.data.total}
		limit={data.list.data.limit}
		offset={data.list.data.offset}
	/>
{:else}
	<EmptyState title="Ничего не нашлось">
		{#if data.kind}
			В разделе «{data.kind.title}» с этим тегом пока ничего нет.
			<a href="/tags/{data.tag.slug}" class="link link-primary">Все разделы</a>
		{/if}
	</EmptyState>
{/if}
