<script lang="ts">
	import { count } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tags = $derived(
		(data.tags.data ?? []).toSorted((a, b) => a.name.localeCompare(b.name, 'ru'))
	);
</script>

<Seo
	title="Теги"
	description="Жанры и темы каталога Nexus: фильмы, сериалы, книги и игры с одним тегом — вместе."
/>

<header class="mb-6">
	<h1 class="text-3xl font-black sm:text-4xl">Теги</h1>
	<p class="mt-1 text-sm text-base-content/50">
		Жанры и темы — общие для фильмов, сериалов, книг и игр.
	</p>
</header>

{#if data.tags.error}
	<LoadError message={data.tags.error} />
{:else if tags.length}
	<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each tags as tag (tag.slug)}
			<li>
				<a
					href="/tags/{tag.slug}"
					class="group flex h-full items-center justify-between gap-3 rounded-box bg-base-200 px-4 py-3 ring-1 ring-base-300 transition hover:-translate-y-0.5 hover:ring-primary"
				>
					<span class="font-semibold group-hover:text-primary">{tag.name}</span>
					<span class="text-xs whitespace-nowrap text-base-content/40"
						>{count(tag.entities_count, ['произведение', 'произведения', 'произведений'])}</span
					>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<EmptyState title="Тегов пока нет" />
{/if}
