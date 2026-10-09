<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { REVIEW_COMMENTS_API } from '#lib/social/review-votes.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import TimeAgo from './TimeAgo.svelte';

	// Комментарии к рецензии — раскрываются под ней по «Комментарии». Список и поле ответа.
	// API ещё нет (REVIEW_COMMENTS_API, docs/backend-questions.md): хранить комментарии в браузере
	// бессмысленно — другие их не увидят, поэтому пока поле неактивно и подпись «появятся позже».
	// Появится API — список придёт в comments, отправка — в onsend.
	let {
		reviewId,
		comments = [],
		onsend
	}: {
		reviewId: string;
		comments?: {
			id: string;
			author: { username: string; display_name?: string | null; avatar_url?: string | null };
			body: string;
			created_at: string;
		}[];
		onsend?: (body: string) => Promise<void>;
	} = $props();

	let draft = $state('');
	let busy = $state(false);
	const enabled = $derived(REVIEW_COMMENTS_API && !!onsend);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const body = draft.trim();
		if (!body || !onsend) return;
		busy = true;
		try {
			await onsend(body);
			draft = '';
		} finally {
			busy = false;
		}
	}
</script>

<div class="mt-3 flex flex-col gap-3 border-l-2 border-base-content/10 pl-4">
	{#if comments.length}
		<ul class="flex flex-col gap-3" aria-label="Комментарии">
			{#each comments as comment (comment.id)}
				<li class="flex gap-2.5">
					<Avatar user={comment.author} size="w-7" />
					<div class="min-w-0 text-sm">
						<p>
							<a href="/u/{comment.author.username}" class="font-semibold hover:text-primary"
								>{comment.author.display_name || comment.author.username}</a
							>
							<span class="text-xs text-base-content/40"><TimeAgo iso={comment.created_at} /></span>
						</p>
						<p class="whitespace-pre-line text-base-content/85">{comment.body}</p>
					</div>
				</li>
			{/each}
		</ul>
	{:else if !enabled}
		<p class="text-sm text-base-content/40">Комментарии к рецензиям появятся позже.</p>
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
				maxlength="2000"
				disabled={!enabled || busy}
				bind:value={draft}
			/>
			<button
				class="btn rounded-full btn-primary btn-sm"
				disabled={!enabled || busy || !draft.trim()}>Отправить</button
			>
		</form>
	{/if}
</div>
