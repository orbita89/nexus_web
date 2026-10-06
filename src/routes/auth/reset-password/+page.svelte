<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { forgetSession, guestApi, session } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import AuthCard from '#lib/components/AuthCard.svelte';

	const token = page.url.searchParams.get('token');

	let password = $state('');
	let repeat = $state('');
	let error = $state('');
	let submitting = $state(false);
	let done = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (password !== repeat) {
			error = 'Пароли не совпадают.';
			return;
		}
		submitting = true;
		error = '';
		try {
			await unwrap(
				guestApi.auth.POST('/api/v1/auth/password/reset', { body: { token: token!, password } })
			);
			// Сброс разлогинивает все устройства — и это тоже.
			if (session.user) forgetSession();
			done = true;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			submitting = false;
		}
	}
</script>

<AuthCard title="Новый пароль">
	{#if !token}
		<Alert>В ссылке нет токена. Откройте ссылку из письма целиком.</Alert>
		<a class="btn btn-outline" href="/auth/forgot-password">Запросить новую ссылку</a>
	{:else if done}
		<Alert kind="success">Пароль изменён. Все устройства вышли из аккаунта — войдите заново.</Alert>
		<a class="btn btn-primary" href="/auth/login">Войти</a>
	{:else}
		<form class="flex flex-col gap-3" onsubmit={submit}>
			<label class="floating-label">
				<span>Новый пароль</span>
				<input
					class="input w-full"
					type="password"
					name="password"
					autocomplete="new-password"
					placeholder="Новый пароль"
					required
					minlength="8"
					maxlength="128"
					bind:value={password}
				/>
			</label>
			<label class="floating-label">
				<span>Повторите пароль</span>
				<input
					class="input w-full"
					type="password"
					name="repeat"
					autocomplete="new-password"
					placeholder="Повторите пароль"
					required
					bind:value={repeat}
				/>
			</label>
			{#if error}<Alert>{error}</Alert>{/if}
			<button class="btn btn-primary" disabled={submitting}>Сохранить пароль</button>
		</form>
	{/if}
</AuthCard>
