<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Вышли здесь или в другой вкладке, сессия истекла — уходим на вход.
	$effect(() => {
		if (session.status === 'guest') goto(loginUrl(page.url), { replaceState: true });
	});
</script>

{#if session.user}
	{@render children()}
{/if}
