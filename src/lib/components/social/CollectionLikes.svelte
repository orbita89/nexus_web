<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import type { LikeValue } from '#lib/social/likes.ts';
	import { applyVote, type VoteState } from '#lib/social/reviews.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// Лайк и дизлайк подборки: один голос на зрителя — другой переставляет, тот же снимает.
	// Та же механика, что у голосов за рецензии (applyVote), поэтому счёт ведём тем же кодом.
	//
	// Счётчики приходят в самой подборке (likes_count, dislikes_count) — второго запроса под
	// кнопку не нужно. А вот mine с сервера всегда null: страница рендерится как для гостя,
	// токенов на сервере нет. Поэтому вошедший один раз перечитывает сводку голосов
	// (GET …/likes — там и свежие числа, и свой голос).
	let {
		collection
	}: {
		collection: { id: string; likes_count: number; dislikes_count: number; mine?: number | null };
	} = $props();

	// Серверная основа; после ответа с токеном и после своего нажатия — своё состояние.
	let own = $state<VoteState | null>(null);
	let busy = $state(false);
	let error = $state('');

	const votes = $derived<VoteState>(
		own ?? {
			likes: collection.likes_count,
			dislikes: collection.dislikes_count,
			vote: asVote(collection.mine)
		}
	);

	function asVote(value: number | null | undefined): LikeValue | null {
		return value === 1 || value === -1 ? value : null;
	}

	$effect(() => {
		const id = collection.id;
		own = null;
		error = '';
		if (session.status !== 'authed') return;
		let stale = false;
		unwrap(api.social.GET('/api/v1/social/collections/{id}/likes', { params: { path: { id } } }))
			.then((summary) => {
				if (stale) return;
				own = {
					likes: summary.likes,
					dislikes: summary.dislikes,
					vote: asVote(summary.mine)
				};
			})
			.catch((e) => !stale && (error = errorMessage(e)));
		return () => {
			stale = true;
		};
	});

	async function vote(value: LikeValue) {
		if (busy) return;
		const before = own;
		const next = applyVote(votes, value);
		own = next;
		busy = true;
		error = '';
		const params = { path: { id: collection.id } };
		try {
			await unwrap(
				next.vote
					? api.social.PUT('/api/v1/social/collections/{id}/like', {
							params,
							body: { value: next.vote }
						})
					: api.social.DELETE('/api/v1/social/collections/{id}/like', { params })
			);
		} catch (e) {
			own = before;
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col items-center gap-2">
	<div class="flex items-center gap-2" role="group" aria-label="Нравится ли подборка">
		{#if session.status === 'guest'}
			<!-- Гостю — вход с возвратом: нажать всё равно нечем. -->
			<a href={loginUrl(page.url)} class="btn gap-2 btn-ghost btn-sm">
				<span aria-hidden="true">👍</span>
				<span class="tabular-nums">{votes.likes}</span>
			</a>
			<a href={loginUrl(page.url)} class="btn gap-2 btn-ghost btn-sm">
				<span aria-hidden="true">👎</span>
				<span class="tabular-nums">{votes.dislikes}</span>
			</a>
		{:else}
			<button
				class={['btn gap-2 btn-sm', votes.vote === 1 ? 'btn-primary' : 'btn-ghost']}
				disabled={busy || session.status === 'loading'}
				aria-pressed={votes.vote === 1}
				aria-label={votes.vote === 1 ? 'Убрать «нравится»' : 'Нравится'}
				title={votes.vote === 1 ? 'Убрать «нравится»' : 'Нравится'}
				onclick={() => vote(1)}
			>
				<span aria-hidden="true">👍</span>
				<span class="tabular-nums">{votes.likes}</span>
			</button>
			<button
				class={['btn gap-2 btn-sm', votes.vote === -1 ? 'btn-primary' : 'btn-ghost']}
				disabled={busy || session.status === 'loading'}
				aria-pressed={votes.vote === -1}
				aria-label={votes.vote === -1 ? 'Убрать «не нравится»' : 'Не нравится'}
				title={votes.vote === -1 ? 'Убрать «не нравится»' : 'Не нравится'}
				onclick={() => vote(-1)}
			>
				<span aria-hidden="true">👎</span>
				<span class="tabular-nums">{votes.dislikes}</span>
			</button>
		{/if}
	</div>
	{#if error}<p role="alert" class="text-sm text-error">{error}</p>{/if}
</div>
