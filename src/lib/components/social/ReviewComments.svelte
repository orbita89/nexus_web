<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaReviewComment } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { browserApi } from '#lib/social/card-live.svelte.ts';
	import { COMMENT_LIMIT, displayName } from '#lib/social/reviews.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import ModerateButton from './ModerateButton.svelte';
	import TimeAgo from './TimeAgo.svelte';

	// Комментарии к рецензии — раскрываются под ней по «Комментарии»: старые сверху, «Показать
	// ещё», поле ответа. Список публичный (без токена), отправка и удаление — от имени вошедшего.
	// count — comments_count рецензии: изменился не из-за нас (реалтайм перечитал ленту) —
	// перечитываем уже показанное. oncount — свой комментарий или удаление поменяли число.
	let {
		reviewId,
		count,
		oncount
	}: { reviewId: string; count: number; oncount: (total: number) => void } = $props();

	const PAGE = 20;

	let items = $state<SchemaReviewComment[]>([]);
	let total = $state<number | null>(null);
	let loading = $state(false);
	let loadError = $state('');
	let draft = $state('');
	let busy = $state(false);
	let error = $state('');

	async function fetchPage(offset: number, limit: number) {
		return unwrap(
			browserApi().social.GET('/api/v1/social/reviews/{id}/comments', {
				params: { path: { id: reviewId }, query: { limit, offset } }
			})
		);
	}

	/** Первая загрузка и перечитывание: столько, сколько уже показано (не меньше страницы). */
	async function reload() {
		loading = true;
		loadError = '';
		try {
			const page = await fetchPage(0, Math.max(PAGE, items.length));
			items = page.items;
			total = page.total;
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
			const page = await fetchPage(items.length, PAGE);
			const seen = new Set(items.map((c) => c.id));
			items = [...items, ...page.items.filter((c) => !seen.has(c.id))];
			total = page.total;
		} catch (e) {
			loadError = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	// Открыли или число у рецензии разошлось с показанным — перечитать. Зависимость — только count.
	$effect(() => {
		const expected = count;
		untrack(() => {
			if (total === null || expected !== total) void reload();
		});
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const body = draft.trim();
		if (!body) return;
		if (body.length > COMMENT_LIMIT) {
			error = `Комментарий — не длиннее ${COMMENT_LIMIT} символов.`;
			return;
		}
		busy = true;
		error = '';
		try {
			const comment = await unwrap(
				api.social.POST('/api/v1/social/reviews/{id}/comments', {
					params: { path: { id: reviewId } },
					body: { body }
				})
			);
			items = [...items, comment];
			total = (total ?? 0) + 1;
			oncount(total);
			draft = '';
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	function removed(id: string) {
		items = items.filter((c) => c.id !== id);
		total = Math.max(0, (total ?? 1) - 1);
		oncount(total);
	}

	async function removeOwn(id: string) {
		error = '';
		try {
			await unwrap(
				api.social.DELETE('/api/v1/social/review-comments/{id}', { params: { path: { id } } })
			);
			removed(id);
		} catch (e) {
			error = errorMessage(e);
		}
	}
</script>

<div class="mt-3 flex flex-col gap-3 border-l-2 border-base-content/10 pl-4">
	{#if items.length}
		<ul class="flex flex-col gap-3" aria-label="Комментарии">
			{#each items as comment (comment.id)}
				{@const own = session.user?.id === comment.author.id}
				<li class="flex gap-2.5">
					<Avatar user={comment.author} size="w-7" />
					<div class="min-w-0 text-sm">
						<p class="flex flex-wrap items-baseline gap-x-2">
							<a href="/u/{comment.author.username}" class="font-semibold hover:text-primary"
								>{displayName(comment.author)}</a
							>
							<span class="text-xs text-base-content/40"><TimeAgo iso={comment.created_at} /></span>
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
										api.social.DELETE('/api/v1/social/admin/review-comments/{id}', {
											params: { path: { id: comment.id } }
										})
									);
									removed(comment.id);
								}}
							/>
						{/if}
					</div>
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
		<div class="h-8 w-48 skeleton" aria-hidden="true"></div>
	{:else if total === 0}
		<p class="text-sm text-base-content/40">Комментариев пока нет.</p>
	{/if}
	{#if loadError}
		<p role="alert" class="text-sm text-error">
			{loadError}
			<button class="link" onclick={reload}>Повторить</button>
		</p>
	{/if}

	{#if session.status === 'guest'}
		<a href={loginUrl(page.url)} class="text-sm text-base-content/50 hover:text-primary"
			>Войдите, чтобы комментировать</a
		>
	{:else if session.status === 'authed'}
		<form class="flex items-center gap-2" onsubmit={submit}>
			<label class="sr-only" for="comment-{reviewId}">Ваш комментарий</label>
			<input
				id="comment-{reviewId}"
				class="input min-w-0 flex-1 rounded-full bg-base-100 input-sm"
				placeholder="Ваш комментарий…"
				maxlength={COMMENT_LIMIT}
				disabled={busy}
				bind:value={draft}
			/>
			<button class="btn rounded-full btn-primary btn-sm" disabled={busy || !draft.trim()}
				>Отправить</button
			>
		</form>
		{#if error}<p role="alert" class="text-xs text-error">{error}</p>{/if}
	{/if}
</div>
