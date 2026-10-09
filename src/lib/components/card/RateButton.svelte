<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { formatDate } from '#lib/catalog/labels.ts';
	import type { MyReviewState } from '#lib/social/my-review.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import { HERO_GLASS as GLASS, HERO_PRIMARY as PRIMARY } from './buttons.ts';
	import Reactions from './Reactions.svelte';

	// «Оценить» в шапке карточки: по нажатию — панель с 1–10 и быстрыми реакциями. Поставили —
	// кнопка показывает «Ваша: 8» цветом оценки. Отдельного блока оценок на странице нет: сводка —
	// бейдж рядом, рецензия — в ленте («Написать рецензию» открывает там форму). До премьеры —
	// «Оценки после премьеры», кнопка неактивна.
	let {
		my,
		slug,
		released,
		releaseDate
	}: { my: MyReviewState; slug: string; released: boolean; releaseDate?: string | null } = $props();

	let details = $state<HTMLDetailsElement>();
	let open = $state(false);

	function close() {
		open = false;
	}

	async function rate(n: number | null) {
		if (await my.rate(n)) close();
	}

	function writeReview() {
		close();
		my.composing = true;
		document.getElementById('activity')?.scrollIntoView({
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
		});
	}

	// Клик мимо панели или Esc — закрыть.
	function onWindowClick(event: MouseEvent) {
		if (open && details && !details.contains(event.target as Node)) close();
	}
	function onKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') close();
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} />

{#snippet star(filled: boolean)}
	<svg
		class="size-4"
		viewBox="0 0 24 24"
		fill={filled ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linejoin="round"
		aria-hidden="true"
		><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg
	>
{/snippet}

{#if !released}
	<div
		class="tooltip tooltip-bottom"
		data-tip={releaseDate ? `Премьера — ${formatDate(releaseDate)}` : 'Ещё не вышло'}
	>
		<button class={[GLASS, 'pointer-events-none opacity-60']} disabled>
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				aria-hidden="true"
				><rect x="4" y="11" width="16" height="10" rx="2" /><path
					d="M8 11V7a4 4 0 0 1 8 0v4"
				/></svg
			>
			Оценки после премьеры
		</button>
	</div>
{:else if session.status === 'guest'}
	<a href={loginUrl(page.url)} class={PRIMARY}>{@render star(false)} Оценить</a>
{:else if session.status === 'loading' || !my.loaded}
	<span class="h-10 w-32 skeleton rounded-full" aria-hidden="true"></span>
{:else}
	<details bind:this={details} bind:open class="dropdown dropdown-bottom">
		<!-- Всегда сплошная оранжевая — главная кнопка шапки; оценили — внутри ваша оценка. -->
		<summary class={[PRIMARY, 'list-none']}>
			{@render star(my.rating != null)}
			{#if my.rating != null}
				<span class="font-medium opacity-80">Ваша</span>
				<span class="font-black tabular-nums">{my.rating}</span>
			{:else}
				Оценить
			{/if}
		</summary>
		<div
			class="dropdown-content z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-box bg-base-200 p-4 shadow-xl ring-1 ring-base-300"
		>
			<section aria-labelledby="rate-title">
				<h2
					id="rate-title"
					class="text-xs font-semibold tracking-widest text-base-content/50 uppercase"
				>
					Ваша оценка
				</h2>
				<div class="mt-2 grid grid-cols-10 gap-1" role="group" aria-label="Ваша оценка от 1 до 10">
					{#each { length: 10 }, i (i)}
						{@const n = i + 1}
						{@const active = my.rating === n}
						<button
							class={[
								'btn h-9 min-h-0 px-0 font-bold tabular-nums btn-sm',
								active
									? 'btn-primary'
									: 'border-transparent bg-base-300 hover:border-primary/40 hover:bg-primary/15 hover:text-primary'
							]}
							aria-pressed={active}
							aria-label="Оценка {n}"
							disabled={my.busy}
							onclick={() => rate(n)}>{n}</button
						>
					{/each}
				</div>
				<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
					<button class="link link-primary link-hover" onclick={writeReview}>
						{my.review?.body ? 'Изменить рецензию' : 'Написать рецензию'}
					</button>
					{#if my.rating != null}
						<button
							class="link text-base-content/60 link-hover"
							disabled={my.busy}
							onclick={() => rate(null)}>Снять оценку</button
						>
					{/if}
				</div>
				{#if my.error}<p role="alert" class="mt-2 text-sm text-error">{my.error}</p>{/if}
			</section>

			<div class="mt-4 border-t border-base-300 pt-3">
				<p class="mb-2 text-xs font-semibold tracking-widest text-base-content/50 uppercase">
					Впечатление
				</p>
				<Reactions {slug} />
			</div>
		</div>
	</details>
{/if}
