<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { LIKE_FILTERS, likePlace, type LikeFilter } from '#lib/social/likes.ts';
	import { profileList } from '#lib/social/profile-list.svelte.ts';
	import StatsSection from './StatsSection.svelte';
	import TimeAgo from './TimeAgo.svelte';

	// «Что нравится»: подборки и люди, которым пользователь поставил лайк (у подборок бывает
	// и дизлайк). Произведений здесь нет — у них оценки, отметки и реакции, а не лайки, поэтому
	// и фильтра такого не предлагаем (бэкенд на target=entity отдаёт пустую страницу).
	let { username }: { username: string } = $props();

	let filter = $state<LikeFilter | undefined>(undefined);

	const list = profileList(
		() => ({ username, filter }),
		(client, key, query) =>
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/likes/given', {
					params: { path: { username: key.username }, query: { target: key.filter, ...query } }
				})
			)
	);
</script>

<StatsSection id="stats-likes-list" title="Что нравится" {list} empty="Лайков пока нет.">
	{#snippet filters()}
		<nav class="tabs tabs-box w-fit tabs-xs" aria-label="Что показывать">
			{#each LIKE_FILTERS as option (option.title)}
				<button
					class={['tab', { 'tab-active': option.value === filter }]}
					aria-current={option.value === filter ? 'true' : undefined}
					onclick={() => (filter = option.value)}>{option.title}</button
				>
			{/each}
		</nav>
	{/snippet}

	<ul class="flex flex-col gap-2" aria-label="Что нравится">
		{#each list.items as like (like.target.kind + (like.target.kind === 'person' ? like.target.person.id : like.target.collection_id))}
			{@const place = likePlace(like.target)}
			<li class="flex items-center gap-3 rounded-box bg-base-200 px-4 py-3 ring-1 ring-base-300">
				<span class="shrink-0 text-lg" aria-hidden="true">{like.value === -1 ? '👎' : '👍'}</span>
				<span class="min-w-0 flex-1">
					{#if place.href}
						<a href={place.href} class="font-semibold hover:text-primary">{place.title}</a>
					{:else}
						<span class="font-semibold">{place.title}</span>
					{/if}
					<span class="block text-xs text-base-content/45">
						{place.note} · <TimeAgo iso={like.created_at} />
					</span>
				</span>
			</li>
		{/each}
	</ul>
</StatsSection>
