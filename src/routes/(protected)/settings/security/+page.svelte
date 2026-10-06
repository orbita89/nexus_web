<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaSessionView } from '#lib/api/generated/auth.ts';
	import { api, logoutAll } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';

	let currentPassword = $state('');
	let newPassword = $state('');
	let passwordError = $state('');
	let passwordSaved = $state(false);
	let submitting = $state(false);

	let sessions = $state<SchemaSessionView[] | null>(null);
	let sessionsError = $state('');

	const dateTime = (iso: string) =>
		new Date(iso).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

	async function loadSessions() {
		try {
			sessions = await unwrap(api.auth.GET('/api/v1/auth/sessions'));
		} catch (e) {
			sessionsError = errorMessage(e);
		}
	}

	onMount(loadSessions);

	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		passwordError = '';
		passwordSaved = false;
		try {
			await unwrap(
				api.auth.POST('/api/v1/auth/password/change', {
					body: { current_password: currentPassword, new_password: newPassword }
				})
			);
			currentPassword = newPassword = '';
			passwordSaved = true;
			await loadSessions();
		} catch (e) {
			passwordError = errorMessage(e);
		} finally {
			submitting = false;
		}
	}

	async function endSession(id: string) {
		sessionsError = '';
		try {
			await unwrap(api.auth.DELETE('/api/v1/auth/sessions/{id}', { params: { path: { id } } }));
			sessions = sessions?.filter((s) => s.id !== id) ?? null;
		} catch (e) {
			sessionsError = errorMessage(e);
		}
	}

	async function endAll() {
		try {
			await logoutAll();
			await goto('/auth/login');
		} catch (e) {
			sessionsError = errorMessage(e);
		}
	}
</script>

<svelte:head><title>Пароль и сессии — Настройки — Nexus</title></svelte:head>

<section class="mb-10">
	<h2 class="mb-2 text-lg font-semibold">Пароль</h2>
	<form class="flex flex-col gap-2" onsubmit={changePassword}>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Текущий пароль</legend>
			<input
				class="input w-full"
				type="password"
				name="current_password"
				autocomplete="current-password"
				required
				bind:value={currentPassword}
			/>
		</fieldset>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Новый пароль</legend>
			<input
				class="input w-full"
				type="password"
				name="new_password"
				autocomplete="new-password"
				required
				minlength="8"
				maxlength="128"
				bind:value={newPassword}
			/>
			<p class="label text-wrap">
				Пароль не задан (входили по ссылке или через провайдера)? Задайте его через
				<a class="link" href="/auth/forgot-password">сброс пароля</a>.
			</p>
		</fieldset>
		{#if passwordError}<Alert>{passwordError}</Alert>{/if}
		{#if passwordSaved}
			<Alert kind="success">Пароль изменён. Остальные устройства вышли из аккаунта.</Alert>
		{/if}
		<div><button class="btn btn-primary" disabled={submitting}>Сменить пароль</button></div>
	</form>
</section>

<section>
	<h2 class="mb-2 text-lg font-semibold">Активные сессии</h2>
	{#if sessionsError}<Alert>{sessionsError}</Alert>{/if}
	{#if sessions === null}
		<span class="loading loading-spinner"></span>
	{:else}
		<ul class="list rounded-box bg-base-200">
			{#each sessions as s (s.id)}
				<li class="list-row items-center">
					<div class="list-col-grow">
						<div class="text-sm">
							{s.user_agent ?? 'Неизвестное устройство'}
							{#if s.current}<span class="ml-1 badge badge-sm badge-primary">это устройство</span
								>{/if}
						</div>
						<div class="text-xs text-base-content/60">
							{s.ip ?? ''} · вход {dateTime(s.created_at)}
						</div>
					</div>
					{#if !s.current}
						<button class="btn btn-ghost btn-sm" onclick={() => endSession(s.id)}>Завершить</button>
					{/if}
				</li>
			{/each}
		</ul>
		<button class="btn mt-4 btn-outline btn-error" onclick={endAll}
			>Выйти на всех устройствах</button
		>
	{/if}
</section>
