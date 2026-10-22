<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import type { SchemaCollectionComment } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { browserApi } from '#lib/social/card-live.svelte.ts';
	import {
		COMMENT_MAX,
		adminDeleteCollectionComment,
		collectionCommentError,
		deleteCollectionComment,
		isCommentsLocked,
		listCollectionComments,
		postCollectionComment,
		setCommentsLocked
	} from '#lib/social/collections.ts';
	import { displayName } from '#lib/social/reviews.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import ModerateButton from './ModerateButton.svelte';
	import TimeAgo from './TimeAgo.svelte';

	// Обсуждение коллекции: плоский список с бэкенда (старые сверху), ответы — под своим корнем
	// одним уровнем. Грузится только в браузере, чтобы страница особой коллекции оставалась
	// кешируемой. Владелец и админ закрывают/открывают обсуждение; админ пишет и в закрытое.
	let {
		collectionId,
		ownerId,
		count = 0,
		locked: lockedInitial = false
	}: { collectionId: string; ownerId: string; count?: number; locked?: boolean } = $props();

	const PAGE = 50;
	const uid = $props.id();

	let items = $state<SchemaCollectionComment[]>([]);
	let total = $state<number | null>(null);
	let loading = $state(false);
	let loadError = $state('');
	// svelte-ignore state_referenced_locally
	let locked = $state(lockedInitial);
	let lockBusy = $state(false);
	let draft = $state('');
	let replyTo = $state<SchemaCollectionComment | null>(null);
	let busy = $state(false);
	let error = $state('');

	const isAdmin = $derived(session.status === 'authed' && session.user?.role === 'admin');
	const isOwner = $derived(session.status === 'authed' && session.user?.id === ownerId);
	const canPost = $derived(session.status === 'authed' && (!locked || isAdmin));
	const shownTotal = $derived(total ?? count);

	// Корни по порядку, под каждым — его ответы по порядку. Корень всегда старше ответов, так что
	// при «старые сверху» он уже загружен; ответ без корня (на всякий случай) — как корень.
	const threads = $derived.by(() => {
		const ids = new Set(items.map((c) => c.id));
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- локальная, внутри $derived
		const replies = new Map<string, SchemaCollectionComment[]>();
		const roots: SchemaCollectionComment[] = [];
		for (const c of items) {
			if (c.parent_id && ids.has(c.parent_id)) {
				const list = replies.get(c.parent_id) ?? [];
				list.push(c);
				replies.set(c.parent_id, list);
			} else roots.push(c);
		}
		return roots.map((root) => ({ root, replies: replies.get(root.id) ?? [] }));
	});

	async function reload() {
		loading = true;
		loadError = '';
		try {
			const res = await listCollectionComments(browserApi(), collectionId, {
				limit: Math.max(PAGE, items.length),
				offset: 0
			});
			items = res.items;
			total = res.total;
		} catch (e) {
			loadError = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	async function more() {
		loading = true;
		loadError = '';
		try {
			const res = await listCollectionComments(browserApi(), collectionId, {
				limit: PAGE,
				offset: items.length
			});
			const seen = new Set(items.map((c) => c.id));
			items = [...items, ...res.items.filter((c) => !seen.has(c.id))];
			total = res.total;
		} catch (e) {
			loadError = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void reload();
	});

	function startReply(comment: SchemaCollectionComment) {
		// Ответ на ответ бэкенд всё равно привяжет к корню — сразу отвечаем корню.
		const rootId = comment.parent_id ?? comment.id;
		replyTo = items.find((c) => c.id === rootId) ?? comment;
		error = '';
		document.getElementById(`${uid}-input`)?.focus();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const body = draft.trim();
		if (!body) return;
		if (body.length > COMMENT_MAX) {
			error = `Комментарий — не длиннее ${COMMENT_MAX} символов.`;
			return;
		}
		busy = true;
		error = '';
		try {
			const comment = await postCollectionComment(api, collectionId, body, replyTo?.id ?? null);
			items = [...items, comment];
			total = (total ?? 0) + 1;
			draft = '';
			replyTo = null;
		} catch (e) {
			if (isCommentsLocked(e)) locked = true;
			error = collectionCommentError(e, errorMessage);
		} finally {
			busy = false;
		}
	}

	function removed(id: string) {
		// Удаление корня убирает и его ответы.
		const gone = items.filter((c) => c.id === id || c.parent_id === id).length;
		items = items.filter((c) => c.id !== id && c.parent_id !== id);
		total = Math.max(0, (total ?? gone) - gone);
		if (replyTo && (replyTo.id === id || replyTo.parent_id === id)) replyTo = null;
	}

	async function removeOwn(id: string) {
		error = '';
		try {
			await deleteCollectionComment(api, id);
			removed(id);
		} catch (e) {
			error = collectionCommentError(e, errorMessage);
		}
	}

	async function toggleLock() {
		lockBusy = true;
		error = '';
		try {
			const updated = await setCommentsLocked(api, collectionId, !locked, !isOwner && isAdmin);
			locked = updated.comments_locked;
		} catch (e) {
			error = collectionCommentError(e, errorMessage);
		} finally {
			lockBusy = false;
		}
	}
</script>

{#snippet comment(c: SchemaCollectionComment, reply: boolean)}
	{@const own = session.user?.id === c.author.id}
	<div class="flex gap-2.5">
		<Avatar user={c.author} size={reply ? 'w-6' : 'w-8'} />
		<div class="min-w-0 flex-1 text-sm">
			<p class="flex flex-wrap items-baseline gap-x-2">
				<a href="/u/{c.author.username}" class="font-semibold hover:text-primary"
					>{displayName(c.author)}</a
				>
				<span class="text-xs text-base-content/40"><TimeAgo iso={c.created_at} /></span>
			</p>
			<p class="whitespace-pre-line text-base-content/85">{c.body}</p>
			<p class="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-base-content/45">
				{#if canPost}
					<button class="hover:text-primary" onclick={() => startReply(c)}>Ответить</button>
				{/if}
				{#if own}
					<button class="hover:text-error" onclick={() => removeOwn(c.id)}>Удалить</button>
				{/if}
			</p>
			{#if !own && isAdmin}
				<ModerateButton
					label="Удалить комментарий"
					question={reply ? 'Удалить комментарий?' : 'Удалить комментарий вместе с ответами?'}
					action={async () => {
						await adminDeleteCollectionComment(api, c.id);
						removed(c.id);
					}}
				/>
			{/if}
		</div>
	</div>
{/snippet}

<section class="mx-auto mt-12 max-w-4xl" aria-labelledby="{uid}-title">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<h2 id="{uid}-title" class="text-lg font-semibold">Обсуждение ({shownTotal})</h2>
		{#if isOwner || isAdmin}
			<button class="btn btn-ghost btn-sm" disabled={lockBusy} onclick={toggleLock}>
				{locked ? 'Открыть обсуждение' : 'Закрыть обсуждение'}
			</button>
		{/if}
	</div>

	{#if locked}
		<p class="mb-4 rounded-box bg-base-200 px-4 py-2 text-sm text-base-content/70" role="status">
			Обсуждение закрыто{#if isAdmin}. Как администратор вы можете писать{/if}.
		</p>
	{/if}

	{#if threads.length}
		<ul class="flex flex-col gap-4" aria-label="Комментарии">
			{#each threads as t (t.root.id)}
				<li>
					{@render comment(t.root, false)}
					{#if t.replies.length}
						<ul class="mt-3 ml-10 flex flex-col gap-3 border-l-2 border-base-content/10 pl-4">
							{#each t.replies as r (r.id)}
								<li>{@render comment(r, true)}</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
		{#if total !== null && items.length < total}
			<button
				class="mt-3 text-sm text-base-content/55 hover:text-primary"
				disabled={loading}
				onclick={more}>Показать ещё</button
			>
		{/if}
	{:else if loading}
		<div class="h-10 w-64 skeleton" aria-hidden="true"></div>
	{:else if total === 0}
		<p class="text-sm text-base-content/45">Комментариев пока нет.</p>
	{/if}
	{#if loadError}
		<p role="alert" class="mt-2 text-sm text-error">
			{loadError}
			<button class="link" onclick={reload}>Повторить</button>
		</p>
	{/if}

	<div class="mt-5">
		{#if session.status === 'guest'}
			<a href={loginUrl(page.url)} class="text-sm text-base-content/55 hover:text-primary"
				>Войдите, чтобы участвовать</a
			>
		{:else if canPost}
			<form class="flex flex-col gap-2" onsubmit={submit}>
				{#if replyTo}
					<p class="flex items-center gap-2 text-xs text-base-content/55">
						Ответ {displayName(replyTo.author)}
						<button type="button" class="link" onclick={() => (replyTo = null)}>Отмена</button>
					</p>
				{/if}
				<label class="sr-only" for="{uid}-input">Ваш комментарий</label>
				<textarea
					id="{uid}-input"
					class="textarea w-full bg-base-100"
					rows="3"
					placeholder={replyTo ? 'Ваш ответ…' : 'Ваш комментарий…'}
					maxlength={COMMENT_MAX}
					disabled={busy}
					bind:value={draft}></textarea>
				<button
					class="btn self-end rounded-full btn-primary btn-sm"
					disabled={busy || !draft.trim()}>Отправить</button
				>
			</form>
		{/if}
		{#if error}<p role="alert" class="mt-2 text-xs text-error">{error}</p>{/if}
	</div>
</section>
