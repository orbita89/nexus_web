<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { refHref } from '#lib/catalog/kinds.ts';
	import { titleWithYear } from '#lib/catalog/labels.ts';
	import { profileList } from '#lib/social/profile-list.svelte.ts';
	import { RATINGS_SORTS, type RatingsSort } from '#lib/social/profile.ts';
	import { ratingTone } from '#lib/social/reviews.ts';
	import StatsSection from './StatsSection.svelte';
	import TimeAgo from './TimeAgo.svelte';

	// Что пользователь оценил. Порядок — состояние раздела, а не адреса: на странице три списка,
	// один ?sort= на всех не поделить.
	let { username }: { username: string } = $props();

	let sort = $state<RatingsSort>('new');

	const list = profileList(
		() => ({ username, sort }),
		(client, key, query) =>
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/ratings', {
					params: { path: { username: key.username }, query: { sort: key.sort, ...query } }
				})
			)
	);

	const TONES: Record<string, string> = {
		high: 'bg-success/20 text-success',
		mid: 'bg-warning/20 text-warning',
		low: 'bg-error/20 text-error'
	};
</script>

<StatsSection id="stats-ratings-list" title="Оценки" {list} empty="Оценок пока нет.">
	{#snippet filters()}
		<nav class="tabs tabs-box w-fit tabs-xs" aria-label="Порядок оценок">
			{#each RATINGS_SORTS as option (option.value)}
				<button
					class={['tab', { 'tab-active': option.value === sort }]}
					aria-current={option.value === sort ? 'true' : undefined}
					onclick={() => (sort = option.value)}>{option.title}</button
				>
			{/each}
		</nav>
	{/snippet}

	<ul class="flex flex-col gap-2" aria-label="Оценки">
		{#each list.items as item (item.entity.id + item.created_at)}
			{@const href = refHref(item.entity)}
			<li class="flex items-center gap-3 rounded-box bg-base-200 px-4 py-3 ring-1 ring-base-300">
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
					<span class="block text-xs text-base-content/45"><TimeAgo iso={item.created_at} /></span>
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
</StatsSection>
