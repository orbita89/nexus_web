<script lang="ts">
	import { page } from '$app/state';
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { markLabels, type Mark } from '#lib/social/marks.ts';
	import type { Marks } from '#lib/social/marks.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import { HERO_GLASS } from './buttons.ts';

	// Отметка одна на карточку: «Посмотреть позже» и «Просмотрено» взаимоисключающие, поэтому и
	// кнопка одна — иконка состояния плюс стрелка, за которой вторая отметка и «Снять». Двумя
	// пилюлями с подписями это занимало целый ряд ради одного значения; подпись — в подсказке.
	let { marks, kind }: { marks: Marks; kind: SchemaEntityKind } = $props();

	const labels = $derived(markLabels(kind));
	const current = $derived(marks.mark);
	const label = $derived(current ? labels[current] : labels.later);
	let open = $state(false);
	let box = $state<HTMLDetailsElement>();

	function choose(mark: Mark | null) {
		open = false;
		if (mark === current || mark === null) {
			if (current) marks.toggle(current);
			return;
		}
		marks.toggle(mark);
	}
</script>

<svelte:window
	onclick={(e) => {
		if (open && box && !box.contains(e.target as Node)) open = false;
	}}
	onkeydown={(e) => {
		if (open && e.key === 'Escape') open = false;
	}}
/>

{#snippet icon(mark: Mark, on: boolean)}
	<svg
		class="size-4"
		viewBox="0 0 24 24"
		fill={on && mark === 'later' ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if mark === 'later'}
			<path d="M6 3h12v18l-6-4-6 4z" />
		{:else if on}
			<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12" /><path d="m8.5 12 2.5 2.5 4.5-5" />
		{:else}
			<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12" /><circle cx="12" cy="12" r="3" />
		{/if}
	</svg>
{/snippet}

{#if session.status === 'guest'}
	<a href={loginUrl(page.url)} class={HERO_GLASS} aria-label={labels.later} title={labels.later}>
		{@render icon('later', false)}
	</a>
{:else}
	<details class="dropdown" bind:this={box} bind:open>
		<summary
			class={[
				HERO_GLASS,
				'gap-1.5',
				current && 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25'
			]}
			aria-label={label}
			title={label}
		>
			{@render icon(current ?? 'later', !!current)}
			<svg
				class="size-3.5 opacity-60"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
			>
		</summary>
		<ul
			class="menu dropdown-content z-30 mt-2 w-56 rounded-box border border-base-300 bg-base-200 p-2 shadow-xl"
		>
			{#each ['later', 'done'] as const as mark (mark)}
				<li>
					<button class={{ 'menu-active': current === mark }} onclick={() => choose(mark)}>
						{@render icon(mark, current === mark)}
						{labels[mark]}
					</button>
				</li>
			{/each}
			{#if current}
				<li>
					<button class="text-base-content/60" onclick={() => choose(null)}>Снять отметку</button>
				</li>
			{/if}
		</ul>
	</details>
{/if}
{#if marks.error}<p role="alert" class="mt-2 text-sm text-error">{marks.error}</p>{/if}
