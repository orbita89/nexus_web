<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';
	import CollectionComments from '#lib/components/social/CollectionComments.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// С сервера «не найдено» — возможно, своя приватная: перечитываем с токеном.
	onMount(() => {
		if (!data.collection) void invalidateAll();
	});

	const collection = $derived(data.collection);
	const back = $derived(collection ? buildFeaturedUrl(collection) : '/collections');
	// Мало комментариев — тонкая страница: не индексируем, но ссылки обходим.
	const indexable = $derived((collection?.comments_count ?? 0) >= 3);
</script>

<svelte:head>
	{#if collection}
		<title>Обсуждение: {collection.title} | Кассандра</title>
		<link rel="canonical" href="{page.url.origin}{back}/discussion" />
		{#if !indexable}<meta name="robots" content="noindex, follow" />{/if}
	{:else}
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

{#if !collection}
	<div class="h-40 skeleton" aria-label="Загрузка коллекции"></div>
{:else}
	<header class="mx-auto mb-6 max-w-4xl">
		<a href={back} class="link text-sm link-hover">← К подборке</a>
		<h1 class="mt-2 text-2xl font-black sm:text-3xl">Обсуждение: {collection.title}</h1>
	</header>
	<div class="mx-auto max-w-4xl">
		{#key collection.id}
			<CollectionComments
				collectionId={collection.id}
				ownerId={collection.owner.id}
				count={collection.comments_count}
				locked={collection.comments_locked}
			/>
		{/key}
	</div>
{/if}
