<script lang="ts">
	import { untrack } from 'svelte';
	import type { MyReviewState } from '#lib/social/my-review.svelte.ts';
	import { BODY_LIMIT } from '#lib/social/reviews.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Форма своей рецензии в плашке ленты — на месте строки «Что думаете о фильме?». Открывается
	// из этой строки, пилюлей «Рецензия» или из «Оценить» в шапке. Оценку можно поставить прямо
	// здесь (1–10 над текстом, повторный клик снимает): она сохраняется вместе с текстом по
	// «Сохранить»; уже поставленная в шапке — выбрана сразу.
	let { my, released }: { my: MyReviewState; released: boolean } = $props();

	let draft = $state('');
	let rating = $state<number | null>(null);
	let confirmDelete = $state(false);

	// Форму открыли (здесь или из «Оценить») — в черновик текущий текст.
	// Текст читаем без зависимости: оценку поменяли, пока пишут, — черновик не сбрасывается.
	$effect(() => {
		if (!my.composing) return;
		draft = untrack(() => my.review?.body ?? '');
		rating = untrack(() => my.rating);
		confirmDelete = false;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (await my.write(draft.trim() || null, rating)) my.composing = false;
	}

	async function remove() {
		if (await my.remove()) my.composing = false;
	}
</script>

{#if released && my.composing}
	<form class="flex flex-col gap-2 py-4" onsubmit={submit} aria-label="Ваша рецензия">
		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<label for="review-body" class="font-semibold">Ваша рецензия</label>
			<div class="flex items-center gap-2">
				<span class="text-xs text-base-content/50">Оценка</span>
				<div class="flex gap-1" role="group" aria-label="Оценка от 1 до 10">
					{#each { length: 10 }, i (i)}
						{@const n = i + 1}
						<button
							type="button"
							class={[
								'btn size-7 min-h-0 rounded-full p-0 text-xs font-bold tabular-nums',
								rating === n
									? 'btn-primary'
									: 'border-transparent bg-base-300 hover:bg-primary/15 hover:text-primary'
							]}
							aria-pressed={rating === n}
							aria-label="Оценка {n}"
							onclick={() => (rating = rating === n ? null : n)}>{n}</button
						>
					{/each}
				</div>
			</div>
		</div>
		<textarea
			id="review-body"
			class="textarea min-h-36 w-full"
			maxlength={BODY_LIMIT}
			placeholder="Что понравилось, что нет — без спойлеров"
			bind:value={draft}></textarea>
		<div class="flex flex-wrap items-center gap-2">
			<button class="btn btn-primary btn-sm" disabled={my.busy}>Сохранить</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (my.composing = false)}
				>Отмена</button
			>
			{#if my.review}
				{#if confirmDelete}
					<span class="flex items-center gap-2 text-sm">
						Удалить оценку и рецензию?
						<button type="button" class="btn btn-error btn-sm" onclick={remove} disabled={my.busy}
							>Удалить</button
						>
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							onclick={() => (confirmDelete = false)}>Нет</button
						>
					</span>
				{:else}
					<button type="button" class="btn btn-ghost btn-sm" onclick={() => (confirmDelete = true)}
						>Удалить</button
					>
				{/if}
			{/if}
			<span class="ml-auto text-xs text-base-content/40 tabular-nums"
				>{draft.length.toLocaleString('ru-RU')} / {BODY_LIMIT.toLocaleString('ru-RU')}</span
			>
		</div>
		{#if my.error}<Alert>{my.error}</Alert>{/if}
	</form>
{/if}
