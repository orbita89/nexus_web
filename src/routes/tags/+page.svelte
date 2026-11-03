<script lang="ts">
	import { tagCount, type TagEntry } from '#lib/catalog/tags.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import KindTabs from '#lib/components/catalog/KindTabs.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const shown = $derived(
		((data.tags.data ?? []) as TagEntry[]).toSorted((a, b) => a.name.localeCompare(b.name, 'ru'))
	);
	const kind = $derived(data.kind);
	const groups = $derived(
		[
			{ title: 'Жанры', tags: shown.filter((t) => t.kind === 'genre') },
			{ title: 'Теги', tags: shown.filter((t) => t.kind === 'tag') }
		].filter((g) => g.tags.length)
	);
</script>

<Seo
	title={kind ? `Теги · ${kind.title}` : 'Теги'}
	description={kind
		? `Жанры и темы раздела «${kind.title}» в каталоге Кассандра.`
		: 'Жанры и темы каталога Кассандра: фильмы, сериалы, книги и игры с одним тегом — вместе.'}
/>

<header class="mb-6">
	<h1 class="text-3xl font-black sm:text-4xl">Теги</h1>
	<p class="mt-1 text-sm text-base-content/50">
		Жанры и темы — общие для фильмов, сериалов, книг и игр.
	</p>
</header>

<div class="mb-8 overflow-x-auto"><KindTabs current={kind ? [kind] : []} single /></div>

{#if data.tags.error}
	<LoadError message={data.tags.error} />
{:else if groups.length}
	<div class="flex flex-col gap-10">
		{#each groups as group (group.title)}
			<section aria-labelledby="tags-{group.title}">
				<h2 id="tags-{group.title}" class="mb-4 text-2xl font-bold">{group.title}</h2>
				<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={group.title}>
					{#each group.tags as tag (tag.slug)}
						<li>
							<a
								href="/tags/{tag.slug}"
								class="group flex h-full flex-col gap-1 rounded-box bg-base-200 px-4 py-3 ring-1 ring-base-300 transition hover:-translate-y-0.5 hover:ring-primary"
							>
								<span class="flex items-center justify-between gap-3">
									<span class="font-semibold group-hover:text-primary">{tag.name}</span>
									<span class="text-xs whitespace-nowrap text-base-content/40"
										>{tagCount(tag, kind?.kind)}</span
									>
								</span>
								{#if tag.description}
									<span class="line-clamp-2 text-xs text-base-content/50">{tag.description}</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{:else if kind}
	<EmptyState title="В этом разделе тегов пока нет" />
{:else}
	<EmptyState title="Тегов пока нет" />
{/if}
