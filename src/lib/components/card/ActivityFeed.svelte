<script lang="ts">
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaReview, SchemaThread } from '#lib/api/generated/social.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { withQuery } from '#lib/catalog/url.ts';
	import { browserApi, liveQuery, type CardLive } from '#lib/social/card-live.svelte.ts';
	import { canCreateThreads } from '#lib/social/forum.ts';
	import type { MyReviewState } from '#lib/social/my-review.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import ReviewCard from '#lib/components/social/ReviewCard.svelte';
	import ThreadItem from '#lib/components/social/ThreadItem.svelte';
	import ReviewComposer from './ReviewComposer.svelte';

	// Рецензии и обсуждения — одна компактная плашка:
	// - вкладки «Все / Рецензии N / Обсуждения N»;
	// - строка «Что думаете о фильме?» с пилюлями «Рецензия» и «Обсуждение» — вместо больших
	//   кнопок; рецензия пишется прямо здесь (ReviewComposer на месте строки);
	// - до SHOWN записей через тонкие линии, свежее сверху (рецензия — по дате, тема — по последнему
	//   сообщению), текст рецензии — 3 строки;
	// - «Все рецензии (N) →» / «Все обсуждения (N) →» — только в своей вкладке и только если записей
	//   больше, чем видно.
	// Только в браузере (ClientSection).
	let {
		slug,
		live,
		my,
		released
	}: { slug: string; live: CardLive; my: MyReviewState; released: boolean } = $props();

	/** Записей в каждой вкладке. */
	const SHOWN = 4;
	/** Рецензий берём с запасом: оценки без текста в ленту не попадают. */
	const FETCH_REVIEWS = 8;

	type Entry =
		| { kind: 'review'; at: string; review: SchemaReview }
		| { kind: 'thread'; at: string; thread: SchemaThread };
	type Filter = 'all' | Entry['kind'];

	const feed = liveQuery(
		() => ({ slug, version: live.version }),
		({ slug }) => {
			const api = browserApi().social;
			const path = { slug };
			return Promise.all([
				unwrap(
					api.GET('/api/v1/social/entities/{slug}/reviews', {
						params: { path, query: { sort: 'new', limit: FETCH_REVIEWS } }
					})
				),
				unwrap(
					api.GET('/api/v1/social/entities/{slug}/threads', {
						params: { path, query: { limit: SHOWN } }
					})
				)
			]);
		}
	);

	let filter = $state<Filter>('all');

	const data = $derived(feed.current?.data);
	const reviewsTotal = $derived(data?.[0].total ?? 0);
	const threadsTotal = $derived(data?.[1].total ?? 0);
	const entries = $derived.by((): Entry[] => {
		if (!data) return [];
		const [reviews, threads] = data;
		const all: Entry[] = [
			// Оценка без текста — не запись ленты, её видно в шапке.
			...reviews.items
				.filter((r) => r.body)
				.map((review) => ({ kind: 'review' as const, at: review.created_at, review })),
			...threads.items.map((thread) => ({
				kind: 'thread' as const,
				at: thread.last_post_at,
				thread
			}))
		];
		return all
			.filter((e) => filter === 'all' || e.kind === filter)
			.sort((a, b) => b.at.localeCompare(a.at))
			.slice(0, SHOWN);
	});
	const shownOf = (kind: Entry['kind']) => entries.filter((e) => e.kind === kind).length;
	// Ссылка на полный список — если в нём больше, чем видно здесь.
	const moreReviews = $derived(filter !== 'thread' && reviewsTotal > shownOf('review'));
	const moreThreads = $derived(filter !== 'review' && threadsTotal > shownOf('thread'));

	const tabs = $derived<{ value: Filter; title: string; total?: number }[]>([
		{ value: 'all', title: 'Все' },
		{ value: 'review', title: 'Рецензии', total: reviewsTotal },
		{ value: 'thread', title: 'Обсуждения', total: threadsTotal }
	]);

	const newThread = $derived(withQuery('/forum/new', { entity: slug }));
	const canThread = $derived(
		session.status === 'guest' ||
			(session.status === 'authed' && canCreateThreads(session.user?.role))
	);
	const pill =
		'btn btn-sm h-8 min-h-0 gap-1.5 rounded-full border-base-content/10 bg-base-content/5 px-3 font-medium hover:border-primary/40 hover:bg-primary/10 hover:text-primary';
</script>

{#snippet pen()}
	<svg
		class="size-4"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg
	>
{/snippet}

{#snippet bubble()}
	<svg
		class="size-4"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg
	>
{/snippet}

<div
	class="divide-y divide-base-content/10 rounded-box bg-base-200 px-5 ring-1 ring-base-content/5 sm:px-6"
>
	<!-- Вкладки -->
	<div role="tablist" aria-label="Что показывать" class="flex gap-5 pt-4">
		{#each tabs as tab (tab.value)}
			<button
				role="tab"
				aria-selected={filter === tab.value}
				class={[
					'-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors',
					filter === tab.value
						? 'border-primary text-base-content'
						: 'border-transparent text-base-content/50 hover:text-base-content'
				]}
				onclick={() => (filter = tab.value)}
				>{tab.title}{#if tab.total}<span class="ml-1.5 font-normal text-base-content/40"
						>{tab.total}</span
					>{/if}</button
			>
		{/each}
	</div>

	<!-- «Что думаете о фильме?» — или форма рецензии на её месте. -->
	{#if released && my.composing}
		<ReviewComposer {my} {released} />
	{:else}
		<div class="flex flex-wrap items-center gap-3 py-3">
			{#if session.status === 'authed' && session.user}
				<Avatar user={session.user} size="w-8" />
			{:else}
				<span class="size-8 shrink-0 rounded-full bg-base-content/10" aria-hidden="true"></span>
			{/if}
			{#if session.status === 'guest'}
				<a
					href={loginUrl(page.url)}
					class="min-w-0 flex-1 truncate text-sm text-base-content/45 hover:text-base-content/70"
					>Войдите, чтобы написать рецензию или начать обсуждение</a
				>
			{:else if released && session.status === 'authed' && my.loaded}
				<button
					class="min-w-0 flex-1 truncate text-left text-sm text-base-content/45 hover:text-base-content/70"
					onclick={() => (my.composing = true)}
					>{my.review?.body
						? 'Ваша рецензия уже есть — дополнить?'
						: 'Что думаете о фильме?'}</button
				>
			{:else}
				<span class="min-w-0 flex-1 truncate text-sm text-base-content/35"
					>{released ? 'Что думаете о фильме?' : 'Рецензии откроются после премьеры'}</span
				>
			{/if}

			<div class="flex gap-2">
				{#if released}
					{#if session.status === 'guest'}
						<a href={loginUrl(page.url)} class={pill} aria-label="Написать рецензию"
							>{@render pen()}Рецензия</a
						>
					{:else if session.status === 'authed' && my.loaded}
						<button
							class={pill}
							aria-label={my.review?.body ? 'Изменить рецензию' : 'Написать рецензию'}
							onclick={() => (my.composing = true)}>{@render pen()}Рецензия</button
						>
					{/if}
				{/if}
				{#if canThread}
					<a
						href={session.status === 'guest' ? loginUrl(page.url) : newThread}
						class={pill}
						aria-label="Начать обсуждение">{@render bubble()}Обсуждение</a
					>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Записи -->
	{#if !feed.current}
		<div aria-hidden="true">
			{#each { length: 3 }, i (i)}
				<div class="flex flex-col gap-2.5 py-4">
					<div class="flex items-center gap-3">
						<div class="size-9 skeleton rounded-full"></div>
						<div class="h-3.5 w-32 skeleton"></div>
					</div>
					<div class="h-3 w-full skeleton"></div>
					<div class="h-3 w-3/5 skeleton"></div>
				</div>
			{/each}
		</div>
	{:else if !feed.current.data}
		<div class="py-4"><LoadError message={feed.current.error} onretry={feed.retry} /></div>
	{:else if entries.length}
		<ul class="divide-y divide-base-content/10" aria-label="Рецензии и обсуждения">
			{#each entries as entry (entry.kind + (entry.kind === 'review' ? entry.review.id : entry.thread.id))}
				<li class="min-w-0">
					{#if entry.kind === 'review'}
						<ReviewCard review={entry.review} flat lines={3} onremoved={() => live.refresh()} />
					{:else}
						<ThreadItem thread={entry.thread} flat />
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="py-6 text-center text-sm text-base-content/45">
			{filter === 'thread'
				? 'Обсуждений пока нет.'
				: filter === 'review'
					? 'Рецензий пока нет — напишите первую.'
					: 'Здесь пока тихо — напишите рецензию или начните обсуждение.'}
		</p>
	{/if}

	{#if moreReviews || moreThreads}
		<p class="flex flex-wrap gap-x-6 gap-y-1 py-3 text-sm">
			{#if moreReviews}
				<a href="{page.url.pathname}/reviews" class="link link-primary link-hover"
					>Все рецензии ({reviewsTotal}) →</a
				>
			{/if}
			{#if moreThreads}
				<a href="{page.url.pathname}/threads" class="link link-primary link-hover"
					>Все обсуждения ({threadsTotal}) →</a
				>
			{/if}
		</p>
	{/if}
</div>
