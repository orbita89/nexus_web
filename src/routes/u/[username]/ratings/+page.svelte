<script lang="ts">
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import { refHref } from '#lib/catalog/kinds.ts';
	import { titleWithYear } from '#lib/catalog/labels.ts';
	import { PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
	import { profileQuery } from '#lib/social/profile-data.svelte.ts';
	import { RATINGS_SORTS, readRatingsSort } from '#lib/social/profile.ts';
	import { displayName, ratingTone } from '#lib/social/reviews.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TimeAgo from '#lib/components/social/TimeAgo.svelte';
	import SortTabs from '#lib/components/social/SortTabs.svelte';
	import StatsBlock from '#lib/components/social/StatsBlock.svelte';
	import type { PageProps } from './$types';

	// Что пользователь оценил: порядок и страница — в адресе (?sort=&offset=), сами данные
	// грузятся в браузере (аналитика закрыта по умолчанию, владельцу нужен токен).
	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);
	const sort = $derived(readRatingsSort(page.url));

	const ratings = profileQuery(
		() => ({ username: page.params.username!, sort, offset: readOffset(page.url) }),
		(client, { username, sort, offset }) =>
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/ratings', {
					params: { path: { username }, query: { sort, limit: PAGE_SIZE, offset } }
				})
			)
	);

	const TONES: Record<string, string> = {
		high: 'bg-success/20 text-success',
		mid: 'bg-warning/20 text-warning',
		low: 'bg-error/20 text-error'
	};
</script>

<Seo
	title="Оценки — {displayName(user)} (@{user.username})"
	description="Что оценил @{user.username} в Nexus: фильмы, сериалы, книги и игры."
/>

<h2 class="sr-only">Оценки</h2>

<div class="mb-4">
	<SortTabs options={RATINGS_SORTS} current={sort} fallback="new" label="Порядок оценок" />
</div>

<StatsBlock query={ratings} username={user.username}>
	{#if ratings.current}
		{@const list = ratings.current}
		{#if list.items.length}
			<ul class="flex max-w-3xl flex-col gap-2" aria-label="Оценки">
				{#each list.items as item (item.entity.id + item.created_at)}
					{@const href = refHref(item.entity)}
					<li
						class="flex items-center gap-3 rounded-box bg-base-200 px-4 py-3 ring-1 ring-base-300"
					>
						<span
							class={[
								'grid size-10 shrink-0 place-items-center rounded-lg font-bold tabular-nums',
								TONES[ratingTone(item.rating)]
							]}>{item.rating}</span
						>
						<span class="min-w-0 flex-1">
							{#if href}
								<a {href} class="font-semibold hover:text-primary">{titleWithYear(item.entity)}</a>
							{:else}
								<span class="font-semibold">{titleWithYear(item.entity)}</span>
							{/if}
							<span class="block text-xs text-base-content/45">
								<TimeAgo iso={item.created_at} />
							</span>
						</span>
						{#if item.has_text}
							{#if href}
								<a href="{href}/reviews" class="badge badge-ghost badge-sm">с рецензией</a>
							{:else}
								<span class="badge badge-ghost badge-sm">с рецензией</span>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
			<Pagination total={list.total} limit={list.limit} offset={list.offset} />
		{:else}
			<EmptyState title="Оценок пока нет">@{user.username} ещё ничего не оценил.</EmptyState>
		{/if}
	{/if}
</StatsBlock>
