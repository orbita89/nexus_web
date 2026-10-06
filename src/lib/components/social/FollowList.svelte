<script lang="ts">
	import type { SchemaPageFollow } from '#lib/api/generated/social.ts';
	import { reviewDate } from '#lib/social/reviews.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import UserCard from './UserCard.svelte';

	let { list, label, empty }: { list: SchemaPageFollow; label: string; empty: string } = $props();
</script>

<h2 class="sr-only">{label}</h2>
{#if list.items.length}
	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={label}>
		{#each list.items as follow (follow.user.id)}
			<li><UserCard user={follow.user} caption="с {reviewDate(follow.since)}" /></li>
		{/each}
	</ul>
	<Pagination total={list.total} limit={list.limit} offset={list.offset} />
{:else}
	<EmptyState title={empty} />
{/if}
