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
			.filter((t) => t.kind === 'genre')
			.toSorted((a, b) => a.name.localeCompare(b.name, 'ru'))
	);
	const kind = $derived(data.kind);
</script>

<Seo
	title={kind ? `Жанры · ${kind.title}` : 'Жанры'}
	description={kind
		? `Жанры раздела «${kind.title}» в каталоге Кассандра.`
		: 'Жанры каталога Кассандра: фильмы, сериалы, книги, игры и картины по жанрам.'}
/>

<header class="mb-6">
	<h1 class="text-3xl font-black sm:text-4xl">Жанры</h1>
	<p class="mt-1 text-sm text-base-content/50">
		Чем произведение является: боевик, антиутопия, портрет.
		<a href="/tags" class="link link-primary link-hover">Теги →</a>
	</p>
</header>

<div class="mb-8 overflow-x-auto"><KindTabs current={kind ? [kind] : []} single /></div>

{#if data.tags.error}
	<LoadError message={data.tags.error} />
{:else if shown.length}
	<TagDirectory tags={shown} kind={kind?.kind} label="Жанры" />
{:else if kind}
	<EmptyState title="В этом разделе жанров пока нет" />
{:else}
	<EmptyState title="Жанров пока нет" />
{/if}
