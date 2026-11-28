<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { HERO_GLASS } from '#lib/components/card/buttons.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import type { TutorTarget } from '#lib/tutor/api.ts';
	import TutorDrawer from './TutorDrawer.svelte';

	// «Обсудить с ИИ» на странице книги или человека: страница статическая — кнопка одна для всех, а что она
	// делает, решается в браузере: вошедшему открывает чат, гостю — вход.
	let {
		slug,
		title,
		target = 'book'
	}: { slug: string; title: string; target?: TutorTarget } = $props();
	let open = $state(false);
</script>

{#snippet spark()}
	<svg
		class="size-4"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path
			d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"
		/></svg
	>
{/snippet}

{#if session.status === 'guest'}
	<a href={loginUrl(page.url)} class={HERO_GLASS} title="Войдите, чтобы обсуждать с ИИ"
		>{@render spark()} Обсудить с ИИ</a
	>
{:else}
	<button type="button" class={HERO_GLASS} onclick={() => (open = true)}
		>{@render spark()} Обсудить с ИИ</button
	>
	<TutorDrawer bind:open {slug} {target} {title} />
{/if}
