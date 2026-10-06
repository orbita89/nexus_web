<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { OAUTH_NEXT_KEY, oauthErrorMessage } from '#lib/auth/oauth.ts';
	import { guestApi, signIn } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import { safeNext } from '#lib/utils/redirect.ts';

	let error = $state('');

	onMount(async () => {
		const params = page.url.searchParams;
		const next = safeNext(sessionStorage.getItem(OAUTH_NEXT_KEY));
		sessionStorage.removeItem(OAUTH_NEXT_KEY);
		const code = params.get('code');
		if (params.get('error') || !code) {
			error = oauthErrorMessage(params.get('error') ?? '');
			return;
		}
		try {
			// Одноразовый код на 2 минуты меняем на токены: в адресной строке токенов нет.
			signIn(await unwrap(guestApi.auth.POST('/api/v1/auth/oauth/exchange', { body: { code } })));
			await goto(next, { replaceState: true });
		} catch (e) {
			error = errorMessage(e);
		}
	});
</script>

<AuthCard title="Вход через провайдера">
	{#if error}
		<Alert>{error}</Alert>
		<a class="btn btn-outline" href="/auth/login">К странице входа</a>
	{:else}
		<p class="flex items-center gap-2">
			<span class="loading loading-sm loading-spinner"></span> Входим…
		</p>
	{/if}
</AuthCard>
