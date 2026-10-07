<script lang="ts">
	import { session } from '#lib/auth/session.svelte.ts';
	import { canCreateThreads } from '#lib/social/forum.ts';
	import { withQuery } from '#lib/catalog/url.ts';

	// «Новая тема» — для author и admin (бэкенд: user — 403). Гостю — вход, обычному
	// пользователю — подсказка, почему кнопки нет.
	let { entity, label = 'Новая тема' }: { entity?: string; label?: string } = $props();

	const href = $derived(withQuery('/forum/new', { entity }));
</script>

{#if session.status === 'guest'}
	<a href="/auth/login?next={encodeURIComponent(href)}" class="btn btn-primary">{label}</a>
{:else if session.status === 'authed' && canCreateThreads(session.user?.role)}
	<a {href} class="btn btn-primary">{label}</a>
{:else if session.status === 'authed'}
	<span class="text-sm text-base-content/50"
		>Темы создают авторы; отвечать в темах может каждый.</span
	>
{/if}
