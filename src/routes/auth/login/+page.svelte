<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
	import { loadProviders } from '#lib/auth/providers.ts';
	import { ensureSession, guestApi, session, signIn } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import ProviderButtons from '#lib/components/ProviderButtons.svelte';
	import { safeNext } from '#lib/utils/redirect.ts';

	const next = $derived(safeNext(page.url.searchParams.get('next')));

	let login = $state('');
	let password = $state('');
	let error = $state('');
	let unverified = $state(false);
	let submitting = $state(false);
	let providers = $state<string[]>([]);

	onMount(async () => {
		providers = await loadProviders();
		await ensureSession();
		if (session.user) goto(next, { replace: true });
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		error = '';
		unverified = false;
		try {
			const tokens = await unwrap(
				guestApi.auth.POST('/api/v1/auth/login', { body: { login: login.trim(), password } })
			);
			signIn(tokens);
			await goto(next, { replace: true });
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				error = 'Неверный логин или пароль.';
			} else if (e instanceof ApiError && e.serverMessage === 'email not verified') {
				unverified = true;
			} else {
				error = errorMessage(e);
			}
		} finally {
			submitting = false;
		}
	}
</script>

<AuthCard title="Вход">
	<form class="flex flex-col gap-3" onsubmit={submit}>
		<label class="floating-label">
			<span>Email или имя пользователя</span>
			<input
				class="input w-full"
				name="login"
				autocomplete="username"
				placeholder="Email или имя пользователя"
				required
				bind:value={login}
			/>
		</label>
		<label class="floating-label">
			<span>Пароль</span>
			<input
				class="input w-full"
				type="password"
				name="password"
				autocomplete="current-password"
				placeholder="Пароль"
				required
				bind:value={password}
			/>
		</label>

		{#if error}<Alert>{error}</Alert>{/if}
		{#if unverified}
			<Alert kind="warning">
				Email не подтверждён. Перейдите по ссылке из письма или
				<a class="link" href="/auth/register?resend=1">отправьте письмо ещё раз</a>.
			</Alert>
		{/if}

		<button class="btn btn-primary" disabled={submitting}>
			{#if submitting}<span class="loading loading-sm loading-spinner"></span>{/if}
			Войти
		</button>
	</form>

	<div class="flex justify-between text-sm">
		<a class="link link-hover" href="/auth/forgot-password">Забыли пароль?</a>
		<a class="link link-hover" href="/auth/email-login">Войти по ссылке</a>
	</div>

	<ProviderButtons {providers} {next} />

	{#snippet footer()}
		Нет аккаунта? <a class="link" href="/auth/register">Регистрация</a>
	{/snippet}
</AuthCard>
