<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaMarkKind } from '#lib/api/generated/social.ts';
	import { refHref } from '#lib/catalog/kinds.ts';
	import { titleWithYear } from '#lib/catalog/labels.ts';
	import { MARK_TITLES } from '#lib/social/profile.ts';
	import { profileList } from '#lib/social/profile-list.svelte.ts';
	import StatsSection from './StatsSection.svelte';
	import TimeAgo from './TimeAgo.svelte';

	// Что отложено на потом и что уже просмотрено — чтобы было видно, где поставлена отметка.
	// Вид отметки — состояние раздела, а не адреса (на странице три списка).
	let { username }: { username: string } = $props();

	let kind = $state<SchemaMarkKind | undefined>(undefined);

	const list = profileList(
		() => ({ username, kind }),
		(client, key, query) =>
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/marks', {
					params: { path: { username: key.username }, query: { kind: key.kind, ...query } }
				})
			)
	);

	const filterOptions = [
		{ value: undefined, title: 'Все' },
		{ value: 'later' as const, title: MARK_TITLES.later },
		{ value: 'done' as const, title: MARK_TITLES.done }
	];
</script>

<StatsSection id="stats-marks-list" title="Отметки" {list} empty="Отметок пока нет.">
	{#snippet filters()}
		<nav class="tabs tabs-box w-fit tabs-xs" aria-label="Вид отметок">
			{#each filterOptions as option (option.title)}
				<button
					class={['tab', { 'tab-active': option.value === kind }]}
					aria-current={option.value === kind ? 'true' : undefined}
					onclick={() => (kind = option.value)}>{option.title}</button
				>
			{/each}
		</nav>
	{/snippet}

	<ul class="flex flex-col gap-2" aria-label="Отметки">
		{#each list.items as item (item.entity.id + item.kind)}
			{@const href = refHref(item.entity)}
			<li class="flex items-center gap-3 rounded-box bg-base-200 px-4 py-3 ring-1 ring-base-300">
				<span class="shrink-0 text-lg" aria-hidden="true">{item.kind === 'done' ? '✓' : '🕑'}</span>
				<span class="min-w-0 flex-1">
					{#if href}
						<a {href} class="font-semibold hover:text-primary">{titleWithYear(item.entity)}</a>
					{:else}
						<span class="font-semibold">{titleWithYear(item.entity)}</span>
					{/if}
					<span class="block text-xs text-base-content/45">
						{MARK_TITLES[item.kind]} · <TimeAgo iso={item.created_at} />
					</span>
				</span>
			</li>
		{/each}
	</ul>
</StatsSection>
