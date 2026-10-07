<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaPost } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { LIMITS, type Quote } from '#lib/social/forum.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import ReplyForm from './ReplyForm.svelte';
	import RichText from './RichText.svelte';
	import TimeAgo from './TimeAgo.svelte';
	import ModerateButton from './ModerateButton.svelte';

	let {
		post,
		quote,
		canReply,
		onposted,
		onchanged
	}: {
		post: SchemaPost;
		quote: Quote | null;
		/** Можно отвечать: вошёл и тема не закрыта. */
		canReply: boolean;
		onposted: (post: SchemaPost) => void;
		/** Своё сообщение изменено или удалено — страница перечитывается. */
		onchanged: () => void;
	} = $props();

	let mode = $state<'view' | 'reply' | 'edit' | 'delete'>('view');
	let draft = $state('');
	let busy = $state(false);
	let error = $state('');

	const own = $derived(
		!post.deleted && session.status === 'authed' && session.user?.id === post.author?.id
	);
	const moderate = $derived(!post.deleted && !own && session.user?.role === 'admin');

	async function run(action: () => Promise<unknown>) {
		busy = true;
		error = '';
		try {
			await action();
			mode = 'view';
			onchanged();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	const path = $derived({ id: post.id });

	function save(event: SubmitEvent) {
		event.preventDefault();
		const body = draft.trim();
		if (!body) return;
		return run(() =>
			unwrap(api.social.PATCH('/api/v1/social/posts/{id}', { params: { path }, body: { body } }))
		);
	}

	const remove = () =>
		run(() => unwrap(api.social.DELETE('/api/v1/social/posts/{id}', { params: { path } })));
</script>

<article
	id="post-{post.id}"
	class="scroll-mt-24 rounded-box p-4 ring-1 ring-base-300 transition target:bg-primary/10 target:ring-primary"
>
	{#if post.deleted || !post.author}
		<p class="text-sm text-base-content/40 italic">Сообщение удалено</p>
	{:else}
		<header class="flex items-center gap-3">
			<a href="/u/{post.author.username}" tabindex="-1" aria-hidden="true">
				<Avatar user={post.author} size="w-8" />
			</a>
			<p class="min-w-0 text-sm">
				<a href="/u/{post.author.username}" class="font-semibold hover:text-primary"
					>{displayName(post.author)}</a
				>
				<span class="text-base-content/50">
					· <TimeAgo iso={post.created_at} />{#if post.edited_at}
						· изменено{/if}
				</span>
			</p>
		</header>

		{#if quote}
			<!-- Ветка: на какое сообщение ответ. Исходное на этой странице — ссылка к нему. -->
			<svelte:element
				this={quote.targetId ? 'a' : 'p'}
				href={quote.targetId ? `#post-${quote.targetId}` : undefined}
				class="mt-3 block border-l-2 border-primary/50 pl-3 text-sm text-base-content/60 hover:text-base-content"
			>
				↳ {#if quote.author}в ответ @{quote.author}{#if quote.excerpt}: «{quote.excerpt}»{/if}{:else}в
					ответ на удалённое сообщение{/if}
			</svelte:element>
		{/if}

		{#if mode === 'edit'}
			<form class="mt-3 flex flex-col gap-2" onsubmit={save}>
				<label class="sr-only" for="edit-{post.id}">Текст сообщения</label>
				<textarea
					id="edit-{post.id}"
					class="textarea min-h-24 w-full"
					maxlength={LIMITS.postBody}
					bind:value={draft}></textarea>
				<div class="flex gap-2">
					<button class="btn btn-primary btn-sm" disabled={busy || !draft.trim()}>Сохранить</button>
					<button type="button" class="btn btn-ghost btn-sm" onclick={() => (mode = 'view')}
						>Отмена</button
					>
				</div>
			</form>
		{:else}
			<RichText text={post.body ?? ''} class="mt-3 text-base-content/90" />
		{/if}

		<div class="mt-2 flex flex-wrap items-center gap-1">
			{#if canReply && mode !== 'reply'}
				<button class="btn btn-ghost btn-xs" onclick={() => (mode = 'reply')}>Ответить</button>
			{/if}
			{#if own && mode === 'view'}
				<button
					class="btn btn-ghost btn-xs"
					onclick={() => {
						draft = post.body ?? '';
						mode = 'edit';
					}}>Изменить</button
				>
				<button class="btn btn-ghost btn-xs" onclick={() => (mode = 'delete')}>Удалить</button>
			{/if}
			{#if moderate && mode === 'view'}
				<ModerateButton
					label="Удалить"
					question="Удалить сообщение? С ответами останется заглушка."
					action={async () => {
						await unwrap(
							api.social.DELETE('/api/v1/social/admin/posts/{id}', {
								params: { path: { id: post.id } }
							})
						);
						onchanged();
					}}
				/>
			{/if}
			{#if mode === 'delete'}
				<span class="flex items-center gap-2 text-sm">
					Удалить сообщение?
					<button class="btn btn-error btn-xs" onclick={remove} disabled={busy}>Удалить</button>
					<button class="btn btn-ghost btn-xs" onclick={() => (mode = 'view')}>Отмена</button>
				</span>
			{/if}
		</div>
		{#if error}<div class="mt-2"><Alert>{error}</Alert></div>{/if}

		{#if mode === 'reply'}
			<div class="mt-3 border-l-2 border-base-300 pl-3">
				<ReplyForm
					threadId={post.thread_id}
					parentId={post.id}
					autofocus
					onposted={(p) => {
						mode = 'view';
						onposted(p);
					}}
					oncancel={() => (mode = 'view')}
				/>
			</div>
		{/if}
	{/if}
</article>
