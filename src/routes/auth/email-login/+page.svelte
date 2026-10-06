<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { guestApi, signIn } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import AuthCard from '#lib/components/AuthCard.svelte';

	// Без token — форма «пришлите ссылку», с token (ссылка из письма) — вход.
	const token = page.url.searchParams.get('token');

	let email = $state('');
	let error = $state('');
	let submitting = $state(false);
	let sentTo = $state('');

	onMount(async () => {
		if (!token) return;
		try {
			signIn(
				await unwrap(guestApi.auth.POST('/api/v1/auth/email/login/confirm', { body: { token } }))
			);
			await goto('/', { replaceState: true });
		} catch (e) {
			error = errorMessage(e);
		}
	});

	async function request(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		error = '';
		try {
			await unwrap(
				guestApi.auth.POST('/api/v1/auth/email/login', { body: { email: email.trim() } })
			);
			sentTo = email.trim();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			submitting = false;
		}
	}
</script>

<AuthCard title="Вход по ссылке">
	{#if token && !error}
		<p class="flex items-center gap-2">
			<span class="loading loading-sm loading-spinner"></span> Входим…
		</p>
	{:else if token}
		<Alert>{error}</Alert>
		<a class="btn btn-outline" href="/auth/email-login">Получить новую ссылку</a>
	{:else if sentTo}
		<p>
			Мы отправили ссылку для входа на <b>{sentTo}</b>. Она действует 15 минут. Если аккаунта с этим
			адресом нет, он будет создан.
		</p>
	{:else}
		<p class="text-sm text-base-content/70">
			Пришлём на почту ссылку, по которой можно войти без пароля.
		</p>
		<form class="flex flex-col gap-3" onsubmit={request}>
			<label class="floating-label">
				<span>Email</span>
				<input
					class="input w-full"
					type="email"
					name="email"
					autocomplete="email"
					placeholder="Email"
					required
					bind:value={email}
				/>
			</label>
			{#if error}<Alert>{error}</Alert>{/if}
			<button class="btn btn-primary" disabled={submitting}>Прислать ссылку</button>
		</form>
	{/if}

	{#snippet footer()}
		<a class="link" href="/auth/login">Войти по паролю</a>
	{/snippet}
</AuthCard>
