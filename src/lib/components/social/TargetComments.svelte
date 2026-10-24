<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaTargetComment } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { browserApi } from '#lib/social/card-live.svelte.ts';
	import {
		COMMENT_BODY_LIMIT,
		commentTarget,
		threadComments,
		type CommentTargetKind
	} from '#lib/social/comments.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import ModerateButton from './ModerateButton.svelte';
	import TimeAgo from './TimeAgo.svelte';

	// Комментарии к произведению, человеку или студии. Список публичный (без токена), отправка
	// и удаление — от имени вошедшего. Ветка одного уровня: ответ на ответ бэкенд привязывает
	// к корню сам, поэтому «Ответить» есть и у ответа, но parent_id мы шлём всегда корневой.
	let {
		kind,
		slug
	}: {
		kind: CommentTargetKind;
		slug: string;
	} = $props();

	const PAGE = 20;
	const target = $derived(commentTarget(kind, slug));

	let items = $state<SchemaTargetComment[]>([]);
	let total = $state<number | null>(null);
	let loading = $state(false);
	let loadError = $state('');
	let draft = $state('');
	let replyTo = $state<SchemaTargetComment | null>(null);
	let busy = $state(false);
	let error = $state('');
	let attempt = $state(0);

	function fetchPage(current: string, offset: number, limit: number) {
		return unwrap(
			browserApi().social.GET('/api/v1/social/comments', {
				params: { query: { target: current, limit, offset } }
			})
		);
	}

	// Сменилась цель (переход на другую карточку) или нажали «Повторить» — список заново.
	$effect(() => {
		void attempt;
		const current = target;
		items = [];
		total = null;
		replyTo = null;
		loadError = '';
		loading = true;
		let stale = false;
		fetchPage(current, 0, PAGE)
			.then((result) => {
				if (stale) return;
				items = result.items;
				total = result.total;
			})
			.catch((e) => !stale && (loadError = errorMessage(e)))
			.finally(() => !stale && (loading = false));
		return () => {
			stale = true;
		};
	});

	async function more() {
		loading = true;
		loadError = '';
		try {
			const result = await fetchPage(target, items.length, PAGE);
			const seen = new Set(items.map((c) => c.id));
			items = [...items, ...result.items.filter((c) => !seen.has(c.id))];
			total = result.total;
		} catch (e) {
			loadError = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	const threads = $derived(threadComments(items));

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const body = draft.trim();
		if (!body) return;
		busy = true;
		error = '';
		try {
			const comment = await unwrap(
				api.social.POST('/api/v1/social/comments', {
					// Ответ на ответ привязываем к корню сами — так же, как это сделает бэкенд.
					body: { target, body, parent_id: replyTo?.parent_id ?? replyTo?.id }
				})
			);
			items = [...items, comment];
			total = (total ?? 0) + 1;
			draft = '';
			replyTo = null;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	function removed(id: string) {
		// Удалили корень — его ответы станут корневыми сами (threadComments), ничего не теряем.
		items = items.filter((c) => c.id !== id);
		total = Math.max(0, (total ?? 1) - 1);
	}

	async function removeOwn(id: string) {
		error = '';
		try {
			await unwrap(api.social.DELETE('/api/v1/social/comments/{id}', { params: { path: { id } } }));
			removed(id);
		} catch (e) {
			error = errorMessage(e);
		}
	}

	function reply(comment: SchemaTargetComment) {
		replyTo = comment;
		document.getElementById(`comment-field-${slug}`)?.focus();
	}
</script>

{#snippet item(comment: SchemaTargetComment)}
	{@const own = session.user?.id === comment.author.id}
	<div class="flex gap-2.5">
		<Avatar user={comment.author} size="w-8" />
		<div class="min-w-0 flex-1 text-sm">
			<p class="flex flex-wrap items-baseline gap-x-2">
				<a href="/u/{comment.author.username}" class="font-semibold hover:text-primary"
					>{displayName(comment.author)}</a
				>
				<span class="text-xs text-base-content/40"><TimeAgo iso={comment.created_at} /></span>
				{#if session.status === 'authed'}
					<button
						class="text-xs text-base-content/40 hover:text-primary"
						onclick={() => reply(comment)}>Ответить</button
					>
				{/if}
				{#if own}
					<button
						class="text-xs text-base-content/40 hover:text-error"
						onclick={() => removeOwn(comment.id)}>Удалить</button
					>
				{/if}
			</p>
			<p class="whitespace-pre-line text-base-content/85">{comment.body}</p>
			{#if !own && session.user?.role === 'admin'}
				<ModerateButton
					label="Удалить комментарий"
					question="Удалить комментарий?"
					action={async () => {
						await unwrap(
							api.social.DELETE('/api/v1/social/admin/comments/{id}', {
								params: { path: { id: comment.id } }
							})
						);
						removed(comment.id);
					}}
				/>
			{/if}
		</div>
	</div>
{/snippet}

<div class="flex max-w-3xl flex-col gap-4">
	{#if threads.length}
		<ul class="flex flex-col gap-4" aria-label="Комментарии">
			{#each threads as thread (thread.root.id)}
				<li>
					{@render item(thread.root)}
					{#if thread.replies.length}
						<ul class="mt-3 flex flex-col gap-3 border-l-2 border-base-content/10 pl-4 sm:ml-10">
							{#each thread.replies as child (child.id)}
								<li>{@render item(child)}</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
		{#if total !== null && items.length < total}
			<button
				class="self-start text-sm text-base-content/55 hover:text-primary"
				disabled={loading}
				onclick={more}>Показать ещё</button
			>
		{/if}
	{:else if loading}
		<div class="h-20 skeleton" aria-label="Загрузка комментариев"></div>
	{:else if total === 0}
		<p class="text-sm text-base-content/40">Комментариев пока нет. Будьте первым.</p>
	{/if}

	{#if loadError}
		<p role="alert" class="text-sm text-error">
			{loadError}
			<button class="link" onclick={() => attempt++}>Повторить</button>
		</p>
	{/if}

	{#if session.status === 'guest'}
		<a href={loginUrl(page.url)} class="text-sm text-base-content/50 hover:text-primary"
			>Войдите, чтобы комментировать</a
		>
	{:else if session.status === 'authed'}
		<form class="flex flex-col gap-2" onsubmit={submit}>
			{#if replyTo}
				<p class="flex items-center gap-2 text-xs text-base-content/60">
					<span>В ответ @{replyTo.author.username}</span>
					<button type="button" class="link" onclick={() => (replyTo = null)}>отменить</button>
				</p>
			{/if}
			<div class="flex items-center gap-2">
				<label class="sr-only" for="comment-field-{slug}">Ваш комментарий</label>
				<input
					id="comment-field-{slug}"
					class="input min-w-0 flex-1 rounded-full bg-base-100 input-sm"
					placeholder="Ваш комментарий…"
					maxlength={COMMENT_BODY_LIMIT}
					disabled={busy}
					bind:value={draft}
				/>
				<button class="btn rounded-full btn-primary btn-sm" disabled={busy || !draft.trim()}
					>Отправить</button
				>
			</div>
			{#if error}<p role="alert" class="text-xs text-error">{error}</p>{/if}
		</form>
	{/if}
</div>
