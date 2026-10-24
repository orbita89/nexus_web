<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// «Написать» и «Заблокировать» в шапке профиля. Профиль рендерится на сервере как для гостя,
	// поэтому блокировку вошедший уточняет в браузере — как и подписку рядом.
	let { username }: { username: string } = $props();

	let blocked = $state(false);
	let blockedBy = $state(false);
	let known = $state(false);
	let busy = $state(false);
	let error = $state('');
	let confirming = $state(false);

	const own = $derived(
		session.status === 'authed' && session.user?.username.toLowerCase() === username.toLowerCase()
	);

	$effect(() => {
		known = false;
		error = '';
		if (session.status !== 'authed' || own) return;
		const name = username;
		unwrap(
			api.social.GET('/api/v1/social/users/{username}', { params: { path: { username: name } } })
		)
			.then((profile) => {
				if (name !== username) return;
				blocked = profile.blocked;
				blockedBy = !!profile.blocked_by;
				known = true;
			})
			.catch((e) => (error = errorMessage(e)));
	});

	async function write() {
		busy = true;
		error = '';
		try {
			await chat.openDm({ id: '', username, display_name: null, avatar_url: null });
		} catch (e) {
			error = e instanceof Error ? e.message : errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function toggleBlock() {
		const next = !blocked;
		const params = { path: { username } };
		busy = true;
		error = '';
		try {
			await unwrap(
				next
					? api.social.PUT('/api/v1/social/users/{username}/block', { params })
					: api.social.DELETE('/api/v1/social/users/{username}/block', { params })
			);
			blocked = next;
			confirming = false;
			void chat.loadChats();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if own}
	<!-- Себе не пишут. -->
{:else if session.status === 'guest'}
	<a href={loginUrl(page.url)} class="btn rounded-full btn-sm">Написать</a>
{:else if known}
	<div class="flex flex-wrap items-center gap-2">
		{#if blocked}
			<span class="text-sm text-base-content/60">Вы заблокировали</span>
		{:else if !blockedBy}
			<button class="btn rounded-full btn-sm" disabled={busy} onclick={write}>Написать</button>
		{/if}
		{#if confirming}
			<button class="btn rounded-full btn-error btn-sm" disabled={busy} onclick={toggleBlock}
				>{blocked ? 'Разблокировать' : 'Точно заблокировать'}</button
			>
			<button class="btn rounded-full btn-ghost btn-sm" onclick={() => (confirming = false)}
				>Отмена</button
			>
		{:else}
			<button
				class="btn rounded-full btn-ghost btn-sm"
				onclick={() => (blocked ? toggleBlock() : (confirming = true))}
				>{blocked ? 'Разблокировать' : 'Заблокировать'}</button
			>
		{/if}
	</div>
{/if}
{#if error}<p role="alert" class="text-xs text-error">{error}</p>{/if}
