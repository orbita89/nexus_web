<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, ensureSession, session, updateUser } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import AuthCard from '#lib/components/AuthCard.svelte';

	let phase = $state<'pending' | 'done' | 'error'>('pending');
	let email = $state('');
	let error = $state('');

	onMount(async () => {
		const token = page.url.searchParams.get('token');
		if (!token) {
			phase = 'error';
			error = 'В ссылке нет токена. Откройте ссылку из письма целиком.';
			return;
		}
		// Вход не обязателен, но с токеном этого пользователя текущая сессия переживёт смену email.
		await ensureSession();
		try {
			const user = await unwrap(
				api.auth.POST('/api/v1/auth/email/change/confirm', { body: { token } })
			);
			if (session.user?.id === user.id) updateUser(user);
			email = user.email;
			phase = 'done';
		} catch (e) {
			phase = 'error';
			error = errorMessage(e);
		}
	});
</script>

<AuthCard title="Смена email">
	{#if phase === 'pending'}
		<p class="flex items-center gap-2">
			<span class="loading loading-sm loading-spinner"></span> Подтверждаем…
		</p>
	{:else if phase === 'done'}
		<Alert kind="success">Email изменён на <b>{email}</b>.</Alert>
		{#if session.user}
			<a class="btn btn-primary" href="/settings/email">К настройкам</a>
		{:else}
			<p class="text-sm">Другие устройства вышли из аккаунта.</p>
			<a class="btn btn-primary" href="/auth/login">Войти</a>
		{/if}
	{:else}
		<Alert>{error}</Alert>
		<a class="btn btn-outline" href="/settings/email">Запросить новую ссылку</a>
	{/if}
</AuthCard>
