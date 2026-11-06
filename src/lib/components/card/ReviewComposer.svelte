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
	let spoiler = $state(false);
	let confirmDelete = $state(false);

	// Форму открыли (здесь или из «Оценить») — в черновик текущий текст.
	// Текст читаем без зависимости: оценку поменяли, пока пишут, — черновик не сбрасывается.
	$effect(() => {
		if (!my.composing) return;
		draft = untrack(() => my.review?.body ?? '');
		rating = untrack(() => my.rating);
		spoiler = untrack(() => my.review?.is_spoiler ?? false);
		confirmDelete = false;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (await my.write(draft.trim() || null, rating, spoiler)) my.composing = false;
	}

	async function remove() {
		if (await my.remove()) my.composing = false;
	}
</script>

{#if released && my.composing}
	<!-- Своя рецензия обведена тем же градиентом, что и заметка: это место, где пишет сам
	     человек, и оно не должно сливаться с чужими записями ленты. -->
	<div class="gradient-frame my-4 rounded-2xl shadow-[0_0_38px_-24px] shadow-primary/40">
		<form
			class="flex flex-col gap-4 rounded-[calc(1rem-1px)] bg-base-100 p-4 sm:p-5"
			onsubmit={submit}
			aria-label="Ваша рецензия"
		>
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
			<!-- Поле без собственной рамки: плашка формы уже отделяет его от ленты, вторая обводка
		     только утяжеляла. На фокусе — тонкое кольцо, а не толстая белая граница. -->
			<textarea
				id="review-body"
				class="min-h-32 w-full resize-y bg-transparent text-lg leading-relaxed font-medium placeholder:font-normal placeholder:text-base-content/30 focus:outline-none"
				maxlength={BODY_LIMIT}
				placeholder="Что понравилось, что нет — без спойлеров"
				bind:value={draft}></textarea>
			<div class="flex flex-wrap items-center gap-2">
				<label class="mr-2 flex cursor-pointer items-center gap-2 text-sm">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked={spoiler} />
					Есть спойлеры
				</label>
				<button
					class="btn-shimmer rounded-full px-5 py-2 text-sm font-semibold shadow-lg shadow-primary/25 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
					disabled={my.busy}>Сохранить</button
				>
				<!-- Без класса btn: у него своя заливка, и рядом с градиентной кнопкой «Отмена»
			     выходила серой плашкой. -->
				<button
					type="button"
					class="rounded-full px-3 py-1.5 text-sm font-semibold text-base-content/60 transition-colors hover:bg-base-content/5 hover:text-base-content"
					onclick={() => (my.composing = false)}>Отмена</button
				>
				<span class="ml-auto"></span>
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
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							onclick={() => (confirmDelete = true)}>Удалить</button
						>
					{/if}
				{/if}
				<!-- Кольцо заполнения, как в заметке: сколько места занято, видно и не читая цифр. -->
				<span class="flex items-center gap-2 text-xs text-base-content/40">
					<svg class="size-4 -rotate-90" viewBox="0 0 20 20" aria-hidden="true">
						<circle
							cx="10"
							cy="10"
							r="8"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							class="text-base-content/15"
						/>
						<circle
							cx="10"
							cy="10"
							r="8"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							class="text-primary transition-[stroke-dashoffset] duration-300"
							stroke-dasharray="50.3"
							stroke-dashoffset={50.3 * (1 - Math.min(1, draft.length / BODY_LIMIT))}
						/>
					</svg>
					<span class="tabular-nums"
						>{draft.length.toLocaleString('ru-RU')} / {BODY_LIMIT.toLocaleString('ru-RU')}</span
					>
				</span>
			</div>
			{#if my.error}<Alert>{my.error}</Alert>{/if}
		</form>
	</div>
{/if}
