<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type {
		SchemaFeedItem,
		SchemaFeedItemType,
		SchemaInterest
	} from '#lib/api/generated/social.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { refHref } from '#lib/catalog/kinds.ts';
	import { filterUrl } from '#lib/catalog/url.ts';
	import { useRealtime } from '#lib/realtime/realtime.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import FeedItem from '#lib/components/social/FeedItem.svelte';

	// Лента (только вошедшим, без SSR): подписки, затем интересы, затем популярное. Пагинация —
	// курсором: «Показать ещё» дописывает следующую страницу. ?type= — фильтр.
	const TYPES: { value: SchemaFeedItemType | null; title: string }[] = [
		{ value: null, title: 'Всё' },
		{ value: 'review', title: 'Рецензии' },
		{ value: 'thread', title: 'Темы' },
		{ value: 'collection', title: 'Коллекции' }
	];
	const type = $derived(
		TYPES.find((t) => t.value === page.url.searchParams.get('type'))?.value ?? null
	);

	let items = $state<SchemaFeedItem[]>([]);
	let cursor = $state<string | null>(null);
	let loading = $state(true);
	let error = $state('');
	let fresh = $state(false);

	async function load(more = false) {
		loading = true;
		error = '';
		try {
			const result = await unwrap(
				api.social.GET('/api/v1/social/feed', {
					params: {
						query: { type: type ?? undefined, cursor: more ? (cursor ?? undefined) : undefined }
					}
				})
			);
			items = more ? [...items, ...result.items] : result.items;
			cursor = result.next_cursor ?? null;
			if (!more) fresh = false;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void type;
		items = [];
		cursor = null;
		void load();
	});

	// Интересы: справа, с отпиской.
	let interests = $state<SchemaInterest[] | null>(null);
	async function loadInterests() {
		try {
			interests = (
				await unwrap(
					api.social.GET('/api/v1/social/interests', { params: { query: { limit: 50 } } })
				)
			).items;
		} catch {
			interests = [];
		}
	}
	void loadInterests();

	async function unwatch(slug: string) {
		await unwrap(
			api.social.DELETE('/api/v1/social/entities/{slug}/interest', { params: { path: { slug } } })
		).catch(() => {});
		await loadInterests();
	}

	// Новое по интересам приходит вживую (каналы интересов сервер подписывает сам после входа):
	// плашка «Есть новое», а не перестройка ленты под рукой. Интересы изменились — перечитываем.
	useRealtime(
		() => null,
		(event) => {
			if (event.event === 'interest.added' || event.event === 'interest.removed') {
				void loadInterests();
			} else if (
				event.event === 'thread.created' ||
				event.event === 'review.created' ||
				event.event === 'post.created'
			) {
				fresh = true;
			}
		},
		() => (fresh = true)
	);
</script>

<svelte:head><title>Лента — Nexus</title></svelte:head>

<div class="grid gap-8 lg:grid-cols-[1fr_18rem]">
	<div class="min-w-0">
		<header class="mb-6">
			<h1 class="text-3xl font-black sm:text-4xl">Лента</h1>
			<p class="mt-1 text-sm text-base-content/50">
				Сначала те, на кого вы подписаны, потом то, за чем вы следите, потом популярное.
			</p>
		</header>

		<nav class="tabs tabs-box mb-6 w-fit tabs-sm" aria-label="Что показывать">
			{#each TYPES as t (t.title)}
				<a
					href={filterUrl(page.url, { type: t.value })}
					class={['tab', { 'tab-active': t.value === type }]}
					aria-current={t.value === type ? 'page' : undefined}>{t.title}</a
				>
			{/each}
		</nav>

		{#if fresh}
			<div class="sticky top-20 z-10 mb-4 flex justify-center">
				<button class="btn shadow-lg btn-primary btn-sm" onclick={() => load()}
					>Есть новое — обновить</button
				>
			</div>
		{/if}

		{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

		{#if items.length}
			<ul class="flex flex-col gap-6" aria-label="Лента">
				{#each items as item, i (`${item.type}-${item.review?.id ?? item.thread?.id ?? item.collection?.id ?? i}`)}
					<li><FeedItem {item} /></li>
				{/each}
			</ul>
			{#if cursor}
				<div class="mt-8 flex justify-center">
					<button class="btn" onclick={() => load(true)} disabled={loading}>Показать ещё</button>
				</div>
			{:else}
				<p class="mt-8 text-center text-sm text-base-content/40">Это всё на сегодня.</p>
			{/if}
		{:else if loading}
			<div class="flex flex-col gap-4">
				{#each [1, 2, 3] as n (n)}<div class="h-28 skeleton"></div>{/each}
			</div>
		{:else if !error}
			<EmptyState title="Пока пусто">
				Подпишитесь на людей и следите за произведениями — их новое появится здесь.
			</EmptyState>
		{/if}
	</div>

	<aside aria-labelledby="interests-title" class="lg:sticky lg:top-20 lg:self-start">
		<h2 id="interests-title" class="mb-3 text-lg font-bold">Вы следите</h2>
		{#if interests === null}
			<div class="h-24 skeleton"></div>
		{:else if interests.length}
			<ul class="flex flex-col gap-1" aria-label="Интересы">
				{#each interests as interest (interest.entity.id)}
					{@const href = refHref(interest.entity)}
					<li class="flex items-center gap-2 rounded-box px-2 py-1 hover:bg-base-200">
						<a href={href ?? '#'} class="min-w-0 flex-1 truncate text-sm hover:text-primary"
							>{interest.entity.title}</a
						>
						<button
							class="btn btn-square btn-ghost btn-xs"
							aria-label="Не следить: {interest.entity.title}"
							onclick={() => unwatch(interest.entity.slug)}>✕</button
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-base-content/50">
				Нажмите «🔔 Следить» на странице фильма, книги или игры — его темы и рецензии будут
				приходить сюда.
			</p>
		{/if}
	</aside>
</div>
