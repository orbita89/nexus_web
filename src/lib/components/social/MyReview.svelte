<script lang="ts">
	import { page } from '$app/state';
	import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaPutReview, SchemaReview } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { BODY_LIMIT, ratingTone } from '#lib/social/reviews.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import Alert from '#lib/components/Alert.svelte';

	// «Ваша оценка» и своя рецензия. Только в браузере: на сервере сессии нет. Клик по оценке
	// сразу сохраняет её (текст рецензии не теряется), повторный клик по той же — снимает.
	let { slug, onchange }: { slug: string; onchange?: () => void } = $props();

	let review = $state<SchemaReview | null>(null);
	let loaded = $state(false);
	let busy = $state(false);
	let error = $state('');
	let editing = $state(false);
	let draft = $state('');
	let confirmDelete = $state(false);

	const path = $derived({ slug });

	async function load() {
		loaded = false;
		error = '';
		try {
			review = await unwrap(
				api.social.GET('/api/v1/social/entities/{slug}/review', { params: { path } })
			);
		} catch (e) {
			review = null;
			if (!(e instanceof ApiError && e.status === 404)) error = errorMessage(e);
		} finally {
			loaded = true;
		}
	}

	$effect(() => {
		// Новая карточка или вход/выход — своя рецензия заново.
		void slug;
		editing = confirmDelete = false;
		if (session.status === 'authed') void load();
		else review = null;
	});

	async function run(action: () => Promise<void>) {
		busy = true;
		error = '';
		try {
			await action();
			onchange?.();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	const save = (body: SchemaPutReview) =>
		run(async () => {
			review = await unwrap(
				api.social.PUT('/api/v1/social/entities/{slug}/review', { params: { path }, body })
			);
		});

	const remove = () =>
		run(async () => {
			await unwrap(
				api.social.DELETE('/api/v1/social/entities/{slug}/review', { params: { path } })
			);
			review = null;
			confirmDelete = editing = false;
		});

	function rate(n: number) {
		const rating = review?.rating === n ? null : n;
		// Сняли оценку, а текста нет — рецензии не остаётся.
		if (rating === null && !review?.body) return remove();
		return save({ rating, body: review?.body ?? null });
	}

	function startEditing() {
		draft = review?.body ?? '';
		editing = true;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const body = draft.trim() || null;
		if (!body && review?.rating == null) {
			error = 'Поставьте оценку или напишите текст.';
			return;
		}
		await save({ rating: review?.rating ?? null, body });
		if (!error) editing = false;
	}
</script>

<section aria-labelledby="my-review-title" class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
	<h2
		id="my-review-title"
		class="text-xs font-semibold tracking-widest text-base-content/50 uppercase"
	>
		Ваша оценка
	</h2>

	{#if session.status === 'guest'}
		<p class="mt-2 text-sm text-base-content/70">
			<a href={loginUrl(page.url)} class="link link-primary">Войдите</a>, чтобы поставить оценку и
			написать рецензию.
		</p>
	{:else if session.status === 'loading' || !loaded}
		<div class="mt-3 h-10 skeleton"></div>
	{:else}
		<div class="mt-3 grid grid-cols-10 gap-1" role="group" aria-label="Ваша оценка от 1 до 10">
			{#each Array.from({ length: 10 }, (_, i) => i + 1) as n (n)}
				{@const tone = ratingTone(n)}
				{@const active = review?.rating === n}
				<button
					class={[
						'btn h-10 min-h-0 px-0 font-bold tabular-nums btn-sm',
						active
							? {
									'btn-success': tone === 'high',
									'btn-warning': tone === 'mid',
									'btn-error': tone === 'low'
								}
							: 'bg-base-300 btn-ghost hover:bg-base-content/15'
					]}
					aria-pressed={active}
					aria-label="Оценка {n}"
					disabled={busy}
					onclick={() => rate(n)}>{n}</button
				>
			{/each}
		</div>

		{#if editing}
			<form class="mt-4 flex flex-col gap-2" onsubmit={submit}>
				<label class="sr-only" for="review-body">Текст рецензии</label>
				<textarea
					id="review-body"
					class="textarea min-h-36 w-full"
					maxlength={BODY_LIMIT}
					placeholder="Что понравилось, что нет — без спойлеров"
					bind:value={draft}></textarea>
				<div class="flex flex-wrap items-center gap-2">
					<button class="btn btn-primary btn-sm" disabled={busy}>Сохранить</button>
					<button type="button" class="btn btn-ghost btn-sm" onclick={() => (editing = false)}
						>Отмена</button
					>
					<span class="ml-auto text-xs text-base-content/40 tabular-nums"
						>{draft.length.toLocaleString('ru-RU')} / {BODY_LIMIT.toLocaleString('ru-RU')}</span
					>
				</div>
			</form>
		{:else}
			{#if review?.body}
				<p class="mt-4 line-clamp-4 text-sm whitespace-pre-line text-base-content/80">
					{review.body}
				</p>
			{/if}
			<div class="mt-4 flex flex-wrap gap-2">
				<button class="btn btn-sm" onclick={startEditing} disabled={busy}>
					{review?.body ? 'Изменить рецензию' : 'Написать рецензию'}
				</button>
				{#if review}
					{#if confirmDelete}
						<span class="flex items-center gap-2 text-sm">
							Удалить оценку и рецензию?
							<button class="btn btn-error btn-sm" onclick={remove} disabled={busy}>Удалить</button>
							<button class="btn btn-ghost btn-sm" onclick={() => (confirmDelete = false)}
								>Отмена</button
							>
						</span>
					{:else}
						<button class="btn btn-ghost btn-sm" onclick={() => (confirmDelete = true)}
							>Удалить</button
						>
					{/if}
				{/if}
			</div>
		{/if}
	{/if}

	{#if error}<div class="mt-3"><Alert>{error}</Alert></div>{/if}
</section>
