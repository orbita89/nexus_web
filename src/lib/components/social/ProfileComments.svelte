<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { commentPlace } from '#lib/social/profile.ts';
	import { profileList } from '#lib/social/profile-list.svelte.ts';
	import StatsSection from './StatsSection.svelte';
	import TimeAgo from './TimeAgo.svelte';

	// Все комментарии одной лентой — и сразу видно, где каждый оставлен: к произведению,
	// человеку, студии, рецензии или в обсуждении подборки (commentPlace по target.kind).
	let { username }: { username: string } = $props();

	const list = profileList(
		() => username,
		(client, name, query) =>
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/comments', {
					params: { path: { username: name }, query }
				})
			)
	);
</script>

<StatsSection id="stats-comments-list" title="Комментарии" {list} empty="Комментариев пока нет.">
	<ul class="flex flex-col gap-3" aria-label="Комментарии">
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
</StatsSection>
