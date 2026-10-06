<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaRelation } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// «Подписаться» в шапке профиля. Сервер рендерит профиль как для гостя (relation = null),
	// поэтому вошедшему профиль перечитывается с токеном — так видно, подписан ли он.
	let {
		username,
		onchange
	}: {
		username: string;
		/** Подписались (+1) или отписались (−1): шапка поправит счётчик подписчиков. */
		onchange?: (delta: 1 | -1) => void;
	} = $props();

	let relation = $state<SchemaRelation | null>(null);
	let busy = $state(false);
	let error = $state('');

	const own = $derived(
		session.status === 'authed' && session.user?.username.toLowerCase() === username.toLowerCase()
	);
	const path = $derived({ username });

	$effect(() => {
		relation = null;
		error = '';
		if (session.status !== 'authed' || own) return;
		const name = username;
		unwrap(
			api.social.GET('/api/v1/social/users/{username}', { params: { path: { username: name } } })
		)
			.then((profile) => {
				if (name === username) relation = profile.relation ?? null;
			})
			.catch((e) => (error = errorMessage(e)));
	});

	async function toggle() {
		if (!relation) return;
		const following = !relation.following;
		busy = true;
		error = '';
		try {
			const call = following
				? api.social.PUT('/api/v1/social/users/{username}/follow', { params: { path } })
				: api.social.DELETE('/api/v1/social/users/{username}/follow', { params: { path } });
			await unwrap(call);
			relation = { ...relation, following };
			onchange?.(following ? 1 : -1);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	{#if session.status === 'guest'}
		<a href={loginUrl(page.url)} class="btn btn-primary">Подписаться</a>
	{:else if own}
		<a href="/settings" class="btn btn-outline">Редактировать профиль</a>
	{:else if relation}
		{#if relation.following}
			<button class="group btn btn-outline" onclick={toggle} disabled={busy} aria-pressed="true">
				<span class="group-hover:hidden">Вы подписаны</span>
				<span class="hidden group-hover:inline">Отписаться</span>
			</button>
		{:else}
			<button class="btn btn-primary" onclick={toggle} disabled={busy} aria-pressed="false">
				{relation.followed_by ? 'Подписаться в ответ' : 'Подписаться'}
			</button>
		{/if}
		{#if relation.followed_by}<span class="badge badge-ghost">Читает вас</span>{/if}
	{:else if !error}
		<div class="h-10 w-36 skeleton" aria-hidden="true"></div>
	{/if}
	{#if error}<span role="alert" class="text-sm text-error">{error}</span>{/if}
</div>
