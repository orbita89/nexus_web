<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaLinkedAccount } from '#lib/api/generated/auth.ts';
	import { oauthErrorMessage, providerTitle } from '#lib/auth/oauth.ts';
	import { loadProviders } from '#lib/auth/providers.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Сюда возвращает привязка: ?linked=github или ?error=already_linked (auth.md, «Привязка провайдеров»).
	const linkedNow = page.url.searchParams.get('linked');
	const linkError = page.url.searchParams.get('error');

	let providers = $state<string[]>([]);
	let linked = $state<SchemaLinkedAccount[] | null>(null);
	let error = $state('');
	let busy = $state('');

	onMount(async () => {
		const [enabled] = await Promise.all([loadProviders(), reload()]);
		providers = enabled;
	});

	async function reload() {
		try {
			linked = await unwrap(api.auth.GET('/api/v1/auth/me/oauth'));
		} catch (e) {
			error = errorMessage(e);
		}
	}

	const accountOf = (provider: string) => linked?.find((a) => a.provider === provider);
	/** Привязанные + включённые, без повторов: отвязать можно и выключенного провайдера. */
	const rows = $derived([...new Set([...(linked ?? []).map((a) => a.provider), ...providers])]);

	async function link(provider: string) {
		busy = provider;
		error = '';
		try {
			const { url } = await unwrap(
				api.auth.POST('/api/v1/auth/me/oauth/{provider}', { params: { path: { provider } } })
			);
			// Переход к провайдеру — браузером: заголовок Authorization туда не передать.
			window.location.assign(url);
		} catch (e) {
			error = errorMessage(e);
			busy = '';
		}
	}

	async function unlink(provider: string) {
		busy = provider;
		error = '';
		try {
			await unwrap(
				api.auth.DELETE('/api/v1/auth/me/oauth/{provider}', { params: { path: { provider } } })
			);
			await reload();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = '';
		}
	}
</script>

<svelte:head><title>Привязанные аккаунты — Настройки — Nexus</title></svelte:head>

<div class="flex flex-col gap-4">
	{#if linkedNow}<Alert kind="success">{providerTitle(linkedNow)} привязан.</Alert>{/if}
	{#if linkError}<Alert>{oauthErrorMessage(linkError)}</Alert>{/if}
	{#if error}<Alert>{error}</Alert>{/if}

	{#if linked === null}
		<span class="loading loading-spinner"></span>
	{:else if rows.length === 0}
		<Alert kind="info">Вход через внешние сервисы пока не настроен.</Alert>
	{:else}
		<ul class="list rounded-box bg-base-200">
			{#each rows as provider (provider)}
				{@const account = accountOf(provider)}
				<li class="list-row items-center">
					<div class="list-col-grow">
						<div class="font-medium">{providerTitle(provider)}</div>
						<div class="text-xs text-base-content/60">
							{account ? (account.email ?? 'привязан') : 'не привязан'}
						</div>
					</div>
					{#if account}
						<button
							class="btn btn-ghost btn-sm"
							disabled={busy !== ''}
							onclick={() => unlink(provider)}>Отвязать</button
						>
					{:else}
						<button
							class="btn btn-outline btn-sm"
							disabled={busy !== ''}
							onclick={() => link(provider)}>Привязать</button
						>
					{/if}
				</li>
			{/each}
		</ul>
		<p class="text-sm text-base-content/60">
			Отвязать можно всегда: войти по ссылке из письма получится и без провайдера.
		</p>
	{/if}
</div>
