<script lang="ts">
	import { originalTitle } from '#lib/admin/archive.ts';
	import { Promotions } from '#lib/admin/promote.svelte.ts';
	import type { SchemaArchiveDoc } from '#lib/api/generated/catalog.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import PromoteButton from '#lib/components/admin/PromoteButton.svelte';
	import PromoteToasts from '#lib/components/admin/PromoteToasts.svelte';

	// «В архиве»: фильмы, которых нет на сайте. Страниц у них нет — поэтому не ссылки (иначе 404).
	// Админу — «Вернуть на сайт» (сессия есть только в браузере, в SSR кнопки нет).
	let { docs }: { docs: SchemaArchiveDoc[] } = $props();

	let gone = $state<string[]>([]);
	const promotions = new Promotions((slug) => (gone = [...gone, slug]));
	const shown = $derived(docs.filter((d) => !gone.includes(d.slug)));
	const isAdmin = $derived(session.user?.role === 'admin');
</script>

{#if shown.length}
	<section class="mt-10 max-w-3xl" aria-labelledby="archive-hint">
		<h2 id="archive-hint" class="text-xl font-bold">В архиве</h2>
		<p class="mb-3 text-sm text-base-content/60">Эти фильмы есть в базе, но не на сайте.</p>
		<ul class="flex flex-col divide-y divide-base-300 rounded-box bg-base-200 ring-1 ring-base-300">
			{#each shown as doc (doc.slug)}
				{@const original = originalTitle(doc)}
				{@const year = yearOf(doc.release_date)}
				<li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
					<div class="min-w-0 flex-1">
						<p class="font-medium">{doc.title}{year ? ` (${year})` : ''}</p>
						{#if original}<p class="text-sm text-base-content/50">{original}</p>{/if}
					</div>
					<span class="badge badge-ghost badge-sm">Нет на сайте</span>
					{#if isAdmin}<PromoteButton {doc} {promotions} />{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<PromoteToasts {promotions} />
