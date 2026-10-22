<script lang="ts">
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { loadEntity, type CardPreview } from '#lib/chat/entities.ts';
	import { entityHref, kindByApi } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import Poster from '#lib/components/catalog/Poster.svelte';

	// Превью карточки под сообщением: ссылку нашли в тексте, саму карточку грузим по слагу.
	// Не нашли — не показываем ничего, в сообщении остаётся ссылка.
	let { link }: { link: { kind: SchemaEntityKind; slug: string } } = $props();

	let entity = $state<CardPreview | null>(null);
	let loading = $state(true);

	$effect(() => {
		const { slug } = link;
		loading = true;
		void loadEntity(slug).then((found) => {
			if (link.slug !== slug) return;
			entity = found;
			loading = false;
		});
	});
</script>

{#if loading}
	<span class="mt-1 flex items-center gap-2 rounded-box bg-base-300/40 p-1.5">
		<span class="h-12 w-8 shrink-0 skeleton rounded"></span>
		<span class="h-4 flex-1 skeleton"></span>
	</span>
{:else if entity}
	<a
		href={entityHref(entity)}
		class="mt-1 flex items-center gap-2 rounded-box bg-base-300/40 p-1.5 transition hover:bg-base-300"
	>
		<span class="w-8 shrink-0">
			<Poster title={entity.title} kind={entity.kind} coverUrl={entity.cover_url} small />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block truncate text-xs font-bold">{entity.title}</span>
			<span class="block text-[0.65rem] text-base-content/50">
				{[kindByApi(entity.kind).one, yearOf(entity.release_date)].filter(Boolean).join(' · ')}
			</span>
		</span>
	</a>
{/if}
