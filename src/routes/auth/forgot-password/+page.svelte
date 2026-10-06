<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import AuthCard from '#lib/components/AuthCard.svelte';

	let email = $state('');
	let error = $state('');
	let submitting = $state(false);
	let sentTo = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		error = '';
		try {
			await unwrap(
				guestApi.auth.POST('/api/v1/auth/password/forgot', { body: { email: email.trim() } })
			);
			sentTo = email.trim();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			submitting = false;
		}
	}
</script>

<AuthCard title="Сброс пароля">
	{#if sentTo}
		<p>
			Если аккаунт с адресом <b>{sentTo}</b> есть, мы отправили на него ссылку для сброса пароля. Она
			действует 1 час.
		</p>
	{:else}
		<form class="flex flex-col gap-3" onsubmit={submit}>
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
		<a class="link" href="/auth/login">Вспомнили? Войти</a>
	{/snippet}
</AuthCard>
