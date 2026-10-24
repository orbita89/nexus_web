<script lang="ts">
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import { refHref } from '#lib/catalog/kinds.ts';
	import { titleWithYear } from '#lib/catalog/labels.ts';
	import { filterUrl, PAGE_SIZE, readOffset } from '#lib/catalog/url.ts';
	import { MARK_TITLES, readMarkKind } from '#lib/social/profile.ts';
	import { profileQuery } from '#lib/social/profile-data.svelte.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TimeAgo from '#lib/components/social/TimeAgo.svelte';
	import StatsBlock from '#lib/components/social/StatsBlock.svelte';
	import type { PageProps } from './$types';

	// Отметки «посмотреть позже» и «просмотрено». Фильтр — ?kind=, без него обе вперемешку
	// (так отвечает бэкенд). Данные — в браузере: аналитика закрыта по умолчанию.
	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);
	const kind = $derived(readMarkKind(page.url));

	const marks = profileQuery(
		() => ({ username: page.params.username!, kind, offset: readOffset(page.url) }),
		(client, { username, kind, offset }) =>
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/marks', {
					params: { path: { username }, query: { kind, limit: PAGE_SIZE, offset } }
				})
			)
	);

	const filters = [
		{ value: undefined, title: 'Все' },
		{ value: 'later' as const, title: MARK_TITLES.later },
		{ value: 'done' as const, title: MARK_TITLES.done }
	];
</script>

<Seo
	title="Отметки — {displayName(user)} (@{user.username})"
	description="Что @{user.username} отложил на потом и что уже посмотрел."
/>

<h2 class="sr-only">Отметки</h2>

<nav class="tabs tabs-box mb-4 w-fit tabs-sm" aria-label="Вид отметок">
	{#each filters as filter (filter.title)}
		<a
			href={filterUrl(page.url, { kind: filter.value ?? null })}
			data-sveltekit-noscroll
			class={['tab', { 'tab-active': filter.value === kind }]}
			aria-current={filter.value === kind ? 'page' : undefined}>{filter.title}</a
		>
	{/each}
</nav>

<StatsBlock query={marks} username={user.username}>
	{#if marks.current}
		{@const list = marks.current}
		{#if list.items.length}
			<ul class="flex max-w-3xl flex-col gap-2" aria-label="Отметки">
				{#each list.items as item (item.entity.id + item.kind)}
					{@const href = refHref(item.entity)}
					<li
						class="flex items-center gap-3 rounded-box bg-base-200 px-4 py-3 ring-1 ring-base-300"
					>
						<span class="shrink-0 text-lg" aria-hidden="true">
							{item.kind === 'done' ? '✓' : '🕑'}
						</span>
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
			<Pagination total={list.total} limit={list.limit} offset={list.offset} />
		{:else}
			<EmptyState title="Отметок пока нет">
				@{user.username} ещё ничего не отметил.
			</EmptyState>
		{/if}
	{/if}
</StatsBlock>
