<script lang="ts">
	import { displayName } from '#lib/social/reviews.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import ThreadItem from '#lib/components/social/ThreadItem.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);
</script>

<Seo
	title="Темы — {displayName(user)} (@{user.username})"
	description="Темы форума, которые начал @{user.username} в Nexus."
/>

<h2 class="sr-only">Темы на форуме</h2>
{#if data.threads.items.length}
	<ul class="flex max-w-3xl flex-col gap-3" aria-label="Темы">
		{#each data.threads.items as thread (thread.id)}
			<li><ThreadItem {thread} showAuthor={false} /></li>
		{/each}
	</ul>
	<Pagination total={data.threads.total} limit={data.threads.limit} offset={data.threads.offset} />
{:else}
	<EmptyState title="Тем пока нет">Здесь появятся темы, которые начнёт @{user.username}.</EmptyState
	>
{/if}
