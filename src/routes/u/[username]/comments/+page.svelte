<script lang="ts">
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import { PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
	import { commentPlace } from '#lib/social/profile.ts';
	import { profileQuery } from '#lib/social/profile-data.svelte.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TimeAgo from '#lib/components/social/TimeAgo.svelte';
	import StatsBlock from '#lib/components/social/StatsBlock.svelte';
	import type { PageProps } from './$types';

	// Все комментарии одной лентой: к произведениям, людям, студиям, рецензиям и в обсуждениях
	// подборок. Где оставлен — дискриминированное объединение по target.kind (commentPlace).
	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);

	const comments = profileQuery(
		() => ({ username: page.params.username!, offset: readOffset(page.url) }),
		(client, { username, offset }) =>
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/comments', {
					params: { path: { username }, query: { limit: PAGE_SIZE, offset } }
				})
			)
	);
</script>

<Seo
	title="Комментарии — {displayName(user)} (@{user.username})"
	description="Комментарии @{user.username} в Nexus."
/>

<h2 class="sr-only">Комментарии</h2>

<StatsBlock query={comments} username={user.username}>
	{#if comments.current}
		{@const list = comments.current}
		{#if list.items.length}
			<ul class="flex max-w-3xl flex-col gap-3" aria-label="Комментарии">
				{#each list.items as comment (comment.id)}
					{@const place = commentPlace(comment.target)}
					<li class="rounded-box bg-base-200 px-4 py-3 ring-1 ring-base-300">
						<p class="flex flex-wrap items-baseline gap-x-2 text-sm">
							<span class="badge badge-ghost badge-sm">{place.note}</span>
							{#if place.href}
								<a href={place.href} class="font-semibold hover:text-primary">{place.title}</a>
							{:else}
								<span class="font-semibold">{place.title}</span>
							{/if}
							<span class="text-xs text-base-content/40"><TimeAgo iso={comment.created_at} /></span>
						</p>
						<p class="mt-1.5 whitespace-pre-line text-base-content/85">{comment.body}</p>
					</li>
				{/each}
			</ul>
			<Pagination total={list.total} limit={list.limit} offset={list.offset} />
		{:else}
			<EmptyState title="Комментариев пока нет">
				@{user.username} ещё ничего не комментировал.
			</EmptyState>
		{/if}
	{/if}
</StatsBlock>
