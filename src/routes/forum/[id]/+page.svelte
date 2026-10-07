<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaPost } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { asKind, refHref } from '#lib/catalog/kinds.ts';
	import { count, summary } from '#lib/catalog/labels.ts';
	import { withQuery } from '#lib/catalog/url.ts';
	import { lastPageOffset, quoteFor } from '#lib/social/forum.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import PostItem from '#lib/components/social/PostItem.svelte';
	import ReplyForm from '#lib/components/social/ReplyForm.svelte';
	import RichText from '#lib/components/social/RichText.svelte';
	import TimeAgo from '#lib/components/social/TimeAgo.svelte';
	import ModerateButton from '#lib/components/social/ModerateButton.svelte';
	import { useRealtime } from '#lib/realtime/realtime.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const thread = $derived(data.thread);
	const posts = $derived(thread.posts);
	const authed = $derived(session.status === 'authed');
	const isAdmin = $derived(session.user?.role === 'admin');
	// В закрытой теме отвечать может только админ (так в API).
	const canReply = $derived(authed && (!thread.is_locked || isAdmin));
	const isAuthor = $derived(authed && session.user?.id === thread.author.id);

	// Реалтайм: новые сообщения других — плашкой «N новых» (страница не прыгает под рукой);
	// правка и удаление — тихо перечитываем; тему удалили — сообщаем.
	let fresh = $state(0);
	let gone = $state(false);
	useRealtime(
		() => [`thread:${thread.id}`],
		(event) => {
			const mine = event.data.author_id === session.user?.id;
			switch (event.event) {
				case 'post.created':
					if (!mine) fresh++;
					break;
				case 'post.updated':
				case 'post.deleted':
				case 'thread.updated':
					void invalidateAll();
					break;
				case 'thread.deleted':
					gone = true;
					break;
			}
		},
		() => void invalidateAll()
	);

	async function showFresh() {
		fresh = 0;
		const offset = lastPageOffset(posts.total + 1, posts.limit);
		await goto(withQuery(page.url.pathname, { offset }), { refreshAll: true, reset: false });
		document.getElementById('posts-title')?.scrollIntoView({ block: 'start' });
	}

	let confirmDelete = $state(false);
	let deleteError = $state('');

	/** Новое сообщение — в конце: последняя страница и прокрутка к нему. */
	async function onPosted(post: SchemaPost) {
		const offset = lastPageOffset(posts.total + 1, posts.limit);
		await goto(`${withQuery(page.url.pathname, { offset })}#post-${post.id}`, { refreshAll: true });
	}

	async function setLocked(locked: boolean) {
		const params = { params: { path: { id: thread.id } } };
		await unwrap(
			locked
				? api.social.PUT('/api/v1/social/admin/threads/{id}/lock', params)
				: api.social.DELETE('/api/v1/social/admin/threads/{id}/lock', params)
		);
		await invalidateAll();
	}

	async function deleteThread() {
		deleteError = '';
		try {
			await unwrap(
				api.social.DELETE('/api/v1/social/threads/{id}', { params: { path: { id: thread.id } } })
			);
			await goto('/forum');
		} catch (e) {
			deleteError = errorMessage(e);
		}
	}
</script>

<Seo title={thread.title} description={summary(thread.body)} />

{#if gone}
	<div class="mb-6">
		<Alert kind="warning">Тема удалена. <a href="/forum" class="link">К форуму</a></Alert>
	</div>
{/if}
{#if fresh}
	<div class="sticky top-20 z-10 mb-4 flex justify-center">
		<button class="btn shadow-lg btn-primary btn-sm" onclick={showFresh}>
			{count(fresh, ['новое сообщение', 'новых сообщения', 'новых сообщений'])} — показать
		</button>
	</div>
{/if}

<article class="max-w-4xl">
	<header>
		<a href="/forum" class="link text-sm text-primary link-hover">← Форум</a>
		<h1 class="mt-2 text-3xl leading-tight font-black sm:text-4xl">
			{thread.title}
			{#if thread.is_locked}<span class="ml-2 badge badge-ghost align-middle">закрыта</span>{/if}
		</h1>
		<div class="mt-3 flex items-center gap-3 text-sm">
			<a href="/u/{thread.author.username}" tabindex="-1" aria-hidden="true"
				><Avatar user={thread.author} size="w-9" /></a
			>
			<p>
				<a href="/u/{thread.author.username}" class="font-semibold hover:text-primary"
					>{displayName(thread.author)}</a
				>
				<span class="text-base-content/50">
					· <TimeAgo iso={thread.created_at} />{#if thread.edited_at}
						· изменено{/if}
				</span>
			</p>
		</div>
	</header>

	{#if thread.entities.length}
		<section aria-label="Произведения темы" class="mt-6">
			<ul class="flex gap-3 overflow-x-auto pb-2">
				{#each thread.entities as entity, i (entity.id)}
					{@const href = refHref(entity)}
					<li class="w-24 shrink-0 sm:w-28">
						<a href={href ?? '#'} class="group block">
							<div class="rounded-box transition group-hover:ring-2 group-hover:ring-primary">
								<Poster
									title={entity.title}
									kind={asKind(entity.kind) ?? 'movie'}
									coverUrl={entity.cover_url}
								/>
							</div>
							<p class="mt-1 line-clamp-2 text-xs font-medium group-hover:text-primary">
								{entity.title}
							</p>
							{#if i === 0 && thread.entities.length > 1}
								<p class="text-[0.65rem] text-primary uppercase">главное</p>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<RichText text={thread.body} class="mt-6 text-lg text-base-content/90" />

	{#if isAuthor}
		<div class="mt-4 flex flex-wrap items-center gap-2">
			<a href="/forum/{thread.id}/edit" class="btn btn-sm">Изменить тему</a>
			{#if confirmDelete}
				<span class="flex items-center gap-2 text-sm">
					Удалить тему со всеми сообщениями?
					<button class="btn btn-error btn-sm" onclick={deleteThread}>Удалить</button>
					<button class="btn btn-ghost btn-sm" onclick={() => (confirmDelete = false)}
						>Отмена</button
					>
				</span>
			{:else}
				<button class="btn btn-ghost btn-sm" onclick={() => (confirmDelete = true)}
					>Удалить тему</button
				>
			{/if}
		</div>
		{#if deleteError}<div class="mt-2"><Alert>{deleteError}</Alert></div>{/if}
	{/if}

	{#if isAdmin}
		<div class="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Модерация темы">
			<button
				class="btn btn-ghost text-warning btn-xs"
				onclick={() => setLocked(!thread.is_locked)}
			>
				🛡 {thread.is_locked ? 'Открыть тему' : 'Закрыть тему'}
			</button>
			{#if !isAuthor}
				<ModerateButton
					label="Удалить тему"
					question="Удалить тему со всеми сообщениями?"
					action={async () => {
						await unwrap(
							api.social.DELETE('/api/v1/social/admin/threads/{id}', {
								params: { path: { id: thread.id } }
							})
						);
						await goto('/forum');
					}}
				/>
			{/if}
		</div>
	{/if}

	<section aria-labelledby="posts-title" class="mt-10">
		<h2 id="posts-title" class="mb-4 text-xl font-bold">
			{posts.total
				? count(posts.total, ['сообщение', 'сообщения', 'сообщений'])
				: 'Сообщений пока нет'}
		</h2>
		{#if posts.items.length}
			<ol class="flex flex-col gap-3" aria-label="Сообщения">
				{#each posts.items as post (post.id)}
					<li>
						<PostItem
							{post}
							quote={quoteFor(post, posts.items)}
							{canReply}
							onposted={onPosted}
							onchanged={() => invalidateAll()}
						/>
					</li>
				{/each}
			</ol>
			<Pagination total={posts.total} limit={posts.limit} offset={posts.offset} />
		{/if}

		<div class="mt-8">
			{#if thread.is_locked && !isAdmin}
				<Alert kind="info">Тема закрыта для ответов.</Alert>
			{:else if session.status === 'guest'}
				<p class="text-base-content/70">
					<a href={loginUrl(page.url)} class="link link-primary">Войдите</a>, чтобы ответить.
				</p>
			{:else if authed}
				<h3 class="mb-2 font-semibold">Ваш ответ</h3>
				<ReplyForm threadId={thread.id} onposted={onPosted} />
			{/if}
		</div>
	</section>
</article>
