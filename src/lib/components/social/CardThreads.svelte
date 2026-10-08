<script lang="ts">
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import { browserApi, liveQuery, type CardLive } from '#lib/social/card-live.svelte.ts';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import ThreadItem from './ThreadItem.svelte';

	// «Обсуждения» на карточке: темы, где есть это произведение (в том числе вместе с другими).
	// Только в браузере (ClientSection).
	let { slug, live }: { slug: string; live: CardLive } = $props();

	/** Тем на карточке; остальные — на /{раздел}/{slug}/threads. */
	const LIMIT = 5;

	const threads = liveQuery(
		() => ({ slug, version: live.version }),
		({ slug }) =>
			unwrap(
				browserApi().social.GET('/api/v1/social/entities/{slug}/threads', {
					params: { path: { slug }, query: { limit: LIMIT } }
				})
			)
	);
	const result = $derived(threads.current);
</script>

{#if !result}
	<div class="h-24 animate-pulse rounded-box bg-base-200" aria-hidden="true"></div>
{:else if !result.data}
	<LoadError message={result.error} onretry={threads.retry} />
{:else if result.data.items.length}
	<ul class="grid gap-3 md:grid-cols-2" aria-label="Обсуждения">
		{#each result.data.items as thread (thread.id)}
			<li class="min-w-0"><ThreadItem {thread} /></li>
		{/each}
	</ul>
	<a
		href="{page.url.pathname}/threads"
		class="mt-4 inline-block link text-sm link-primary link-hover"
		>Все обсуждения ({result.data.total}) →</a
	>
{:else}
	<p class="rounded-box border border-dashed border-base-300 p-6 text-center text-base-content/60">
		Обсуждений пока нет. Тему можно привязать сразу к нескольким произведениям — например, к книге и
		её экранизациям.
	</p>
{/if}
