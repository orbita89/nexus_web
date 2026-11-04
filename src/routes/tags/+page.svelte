<script lang="ts">
	import type { TagEntry } from '#lib/catalog/tags.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import KindTabs from '#lib/components/catalog/KindTabs.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TagDirectory from '#lib/components/catalog/TagDirectory.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const shown = $derived(
		((data.tags.data ?? []) as TagEntry[])
			.filter((t) => t.kind === 'tag')
			.toSorted((a, b) => a.name.localeCompare(b.name, 'ru'))
	);
	const kind = $derived(data.kind);
</script>

<Seo
	title={kind ? `Теги · ${kind.title}` : 'Теги'}
	description={kind
		? `Темы раздела «${kind.title}» в каталоге Кассандра.`
		: 'Теги каталога Кассандра: фильмы, сериалы, книги и игры с одной темой — вместе.'}
/>

<header class="mb-6">
	<h1 class="text-3xl font-black sm:text-4xl">Теги</h1>
	<p class="mt-1 text-sm text-base-content/50">
		Темы поперёк разделов: экранизация, открытый мир, постапокалипсис.
		<a href="/genres" class="link link-primary link-hover">Жанры →</a>
	</p>
</header>

<div class="mb-8 overflow-x-auto"><KindTabs current={kind ? [kind] : []} single /></div>

{#if data.tags.error}
	<LoadError message={data.tags.error} />
{:else if shown.length}
	<TagDirectory tags={shown} kind={kind?.kind} label="Теги" />
{:else if kind}
	<EmptyState title="В этом разделе тегов пока нет" />
{:else}
	<EmptyState title="Тегов пока нет" />
{/if}
