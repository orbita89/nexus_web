<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';

	let newEmail = $state('');
	let password = $state('');
	let error = $state('');
	let sentTo = $state('');
	let submitting = $state(false);
	const hasPassword = $derived(session.user?.has_password ?? false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		error = '';
		try {
			await unwrap(
				api.auth.POST('/api/v1/auth/me/email', {
					body: { new_email: newEmail.trim(), password: hasPassword ? password : null }
				})
			);
			sentTo = newEmail.trim();
			password = '';
		} catch (e) {
			error = errorMessage(e);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head><title>Email — Настройки — Nexus</title></svelte:head>

<p class="mb-4">Текущий email: <b>{session.user?.email}</b></p>

{#if sentTo}
	<Alert kind="success">
		Мы отправили ссылку на <b>{sentTo}</b>. Email сменится, когда вы перейдёте по ней (ссылка
		действует 1 час).
	</Alert>
{:else}
	<form class="flex flex-col gap-4" onsubmit={submit}>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Новый email</legend>
			<input
				class="input w-full"
				type="email"
				name="new_email"
				autocomplete="email"
				required
				bind:value={newEmail}
			/>
		</fieldset>
		{#if hasPassword}
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Текущий пароль</legend>
				<input
					class="input w-full"
					type="password"
					name="password"
					autocomplete="current-password"
					required
					bind:value={password}
				/>
			</fieldset>
		{/if}
		{#if error}<Alert>{error}</Alert>{/if}
		<div><button class="btn btn-primary" disabled={submitting}>Сменить email</button></div>
	</form>
{/if}
