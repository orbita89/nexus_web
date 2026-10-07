<script lang="ts">
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaPageCollection } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import CollectionCard from '#lib/components/social/CollectionCard.svelte';
	import NewCollection from '#lib/components/social/NewCollection.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);
	const own = $derived(session.status === 'authed' && session.user?.id === user.id);

	// Владельцу — список с личными коллекциями (сервер отдал только публичные).
	let mine = $state<SchemaPageCollection | null>(null);
	$effect(() => {
		mine = null;
		if (!own) return;
		const offset = readOffset(page.url);
		unwrap(
			api.social.GET('/api/v1/social/users/{username}/collections', {
				params: { path: { username: user.username }, query: { limit: PAGE_SIZE, offset } }
			})
		)
			.then((list) => (mine = list))
			.catch(() => {});
	});
	const list = $derived(mine ?? data.collections);
</script>

<Seo title="Коллекции — {displayName(user)} (@{user.username})" />
<h2 class="sr-only">Коллекции</h2>

{#if own}<div class="mb-6"><NewCollection /></div>{/if}

{#if list.items.length}
	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Коллекции">
		{#each list.items as collection (collection.id)}
			<li><CollectionCard {collection} showOwner={false} /></li>
		{/each}
	</ul>
	<Pagination total={list.total} limit={list.limit} offset={list.offset} />
{:else}
	<EmptyState title="Коллекций пока нет" />
{/if}
