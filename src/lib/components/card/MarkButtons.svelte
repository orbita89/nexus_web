<script lang="ts">
	import { page } from '$app/state';
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { markLabels, type Mark, type Marks } from '#lib/social/marks.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// «Посмотреть позже» (закладка) и «Просмотрено» (глаз) в шапке, под кнопками. Маленькие
	// пилюли-переключатели: включённая — оранжевая. Гостю — вход.
	let { marks, kind }: { marks: Marks; kind: SchemaEntityKind } = $props();

	const labels = $derived(markLabels(kind));
	const MARKS: Mark[] = ['later', 'done'];
</script>

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

<div class="mt-5 flex flex-wrap gap-2" role="group" aria-label="Мои отметки">
	{#each MARKS as mark (mark)}
		{@const on = marks.mark === mark}
		{#if session.status === 'guest'}
			<a
				href={loginUrl(page.url)}
				class="btn h-8 min-h-0 gap-1.5 rounded-full border-base-content/10 bg-base-content/5 px-3 text-sm font-medium backdrop-blur-md btn-sm hover:border-base-content/25"
				>{@render icon(mark, false)}{labels[mark]}</a
			>
		{:else}
			<button
				class={[
					'btn h-8 min-h-0 gap-1.5 rounded-full px-3 text-sm font-medium backdrop-blur-md transition btn-sm',
					on
						? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25'
						: 'border-base-content/10 bg-base-content/5 hover:border-base-content/25'
				]}
				aria-pressed={on}
				disabled={session.status !== 'authed'}
				onclick={() => marks.toggle(mark)}>{@render icon(mark, on)}{labels[mark]}</button
			>
		{/if}
	{/each}
</div>
