<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { loadProviders } from '#lib/auth/providers.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import ProviderButtons from '#lib/components/ProviderButtons.svelte';

	let email = $state('');
	let username = $state('');
	let password = $state('');
	let error = $state('');
	let submitting = $state(false);
	let providers = $state<string[]>([]);
	/** Письмо отправлено: регистрация прошла или просим письмо повторно. */
	let sentTo = $state('');
	let resendMode = $state(page.url.searchParams.has('resend'));
	let resent = $state(false);

	onMount(async () => {
		providers = await loadProviders();
	});

	async function register(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		error = '';
		try {
			await unwrap(
				guestApi.auth.POST('/api/v1/auth/register', {
					body: { email: email.trim(), username: username.trim(), password }
				})
			);
			sentTo = email.trim();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			submitting = false;
		}
	}

	async function resend(event?: SubmitEvent) {
		event?.preventDefault();
		submitting = true;
		error = '';
		try {
			await unwrap(
				guestApi.auth.POST('/api/v1/auth/email/verify/resend', { body: { email: email.trim() } })
			);
			sentTo = email.trim();
			resent = true;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			submitting = false;
		}
	}
</script>

{#if sentTo}
	<AuthCard title="Проверьте почту">
		<p>
			Мы отправили письмо на <b>{sentTo}</b>. Перейдите по ссылке из него, чтобы подтвердить email и
			войти.
		</p>
		{#if resent}<Alert kind="success">Письмо отправлено ещё раз.</Alert>{/if}
		{#if error}<Alert>{error}</Alert>{/if}
		<button class="btn btn-outline" disabled={submitting} onclick={() => resend()}>
			Отправить ещё раз
		</button>
	</AuthCard>
{:else if resendMode}
	<AuthCard title="Письмо для подтверждения">
		<form class="flex flex-col gap-3" onsubmit={resend}>
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
			<button class="btn btn-primary" disabled={submitting}>Отправить письмо</button>
		</form>
		{#snippet footer()}
			<button class="link" onclick={() => (resendMode = false)}>Регистрация</button>
		{/snippet}
	</AuthCard>
{:else}
	<AuthCard title="Регистрация">
		<form class="flex flex-col gap-3" onsubmit={register}>
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
			<label class="floating-label">
				<span>Имя пользователя</span>
				<input
					class="input w-full"
					name="username"
					autocomplete="username"
					placeholder="Имя пользователя"
					required
					minlength="3"
					maxlength="32"
					pattern="[A-Za-z0-9_.\-]+"
					title="3–32 символа: латиница, цифры, «_», «-», «.»"
					bind:value={username}
				/>
			</label>
			<label class="floating-label">
				<span>Пароль</span>
				<input
					class="input w-full"
					type="password"
					name="password"
					autocomplete="new-password"
					placeholder="Пароль"
					required
					minlength="8"
					maxlength="128"
					bind:value={password}
				/>
			</label>
			<p class="text-xs text-base-content/60">Пароль — от 8 символов.</p>
			{#if error}<Alert>{error}</Alert>{/if}
			<button class="btn btn-primary" disabled={submitting}>
				{#if submitting}<span class="loading loading-sm loading-spinner"></span>{/if}
				Зарегистрироваться
			</button>
		</form>

		<ProviderButtons {providers} />

		{#snippet footer()}
			Уже есть аккаунт? <a class="link" href="/auth/login">Войти</a>
		{/snippet}
	</AuthCard>
{/if}
