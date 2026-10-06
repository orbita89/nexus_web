<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { guestApi, session, signIn } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import AuthCard from '#lib/components/AuthCard.svelte';

	let phase = $state<'pending' | 'done' | 'error'>('pending');
	let error = $state('');

	onMount(async () => {
		const token = page.url.searchParams.get('token');
		if (!token) {
			phase = 'error';
			error = 'В ссылке нет токена. Откройте ссылку из письма целиком.';
			return;
		}
		try {
			signIn(await unwrap(guestApi.auth.POST('/api/v1/auth/email/verify', { body: { token } })));
			phase = 'done';
		} catch (e) {
			phase = 'error';
			error = errorMessage(e);
		}
	});
</script>

<AuthCard title="Подтверждение email">
	{#if phase === 'pending'}
		<p class="flex items-center gap-2">
			<span class="loading loading-sm loading-spinner"></span> Подтверждаем…
		</p>
	{:else if phase === 'done'}
		<Alert kind="success">Email подтверждён, вы вошли.</Alert>
		<div class="flex gap-2">
			<a class="btn btn-primary" href="/">На главную</a>
			{#if session.user}
				<a class="btn btn-ghost" href="/settings">Настроить профиль</a>
			{/if}
		</div>
	{:else}
		<Alert>{error}</Alert>
		<a class="btn btn-outline" href="/auth/register?resend=1">Отправить письмо ещё раз</a>
	{/if}
</AuthCard>
