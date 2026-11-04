<script lang="ts">
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { tagCount, tagCountShort, type TagEntry } from '#lib/catalog/tags.ts';

	// Справочник жанров или тегов: сетка плиток с коротким счётчиком. Жанры и теги живут на
	// разных страницах (/genres и /tags), а сетка у них одна.
	let {
		tags,
		kind,
		label
	}: {
		tags: TagEntry[];
		/** Выбранный раздел: от него зависит счётчик. */
		kind?: SchemaEntityKind;
		label: string;
	} = $props();
</script>

<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={label}>
	{#each tags as tag (tag.slug)}
		<li>
			<a
				href="/tags/{tag.slug}"
				class="group flex h-full flex-col gap-1 rounded-box bg-base-200 px-4 py-3 ring-1 ring-base-300 transition hover:-translate-y-0.5 hover:ring-primary"
			>
				<span class="flex items-baseline justify-between gap-3">
					<span class="font-semibold group-hover:text-primary">{tag.name}</span>
					<span class="text-xs whitespace-nowrap text-base-content/40" title={tagCount(tag, kind)}
						>{tagCountShort(tag, kind)}</span
					>
				</span>
				{#if tag.description}
					<span class="line-clamp-2 text-xs text-base-content/50">{tag.description}</span>
				{/if}
			</a>
		</li>
	{/each}
</ul>
