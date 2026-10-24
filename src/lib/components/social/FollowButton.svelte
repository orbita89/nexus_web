<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaRelation } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import type { ProfileViewer } from '#lib/social/profile-viewer.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// «Подписаться» в шапке профиля. Сервер рендерит профиль как для гостя (relation = null),
	// поэтому вошедшему шапка перечитывает профиль с токеном (ProfileViewer) — так видно, подписан
	// ли он. Тот же запрос обслуживает «Нравится» (LikeButton).
	let {
		username,
		viewer,
		onchange
	}: {
		username: string;
		viewer: ProfileViewer;
		/** Подписались (+1) или отписались (−1): шапка поправит счётчик подписчиков. */
		onchange?: (delta: 1 | -1) => void;
	} = $props();

	// Своё состояние после нажатия; до него — то, что пришло с перечитанным профилем.
	let changed = $state<SchemaRelation | null>(null);
	let busy = $state(false);
	let error = $state('');

	const own = $derived(viewer.own);
	const relation = $derived(changed ?? viewer.profile?.relation ?? null);
	const path = $derived({ username });

	// Профиль перечитали заново (сменился пользователь или вход) — свой ответ больше не актуален.
	$effect(() => {
		void viewer.profile;
		changed = null;
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
			changed = { ...relation, following };
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
			<!-- Имя не зависит от наведения: видимый текст меняется на «Отписаться», а имя — нет. -->
			<button
				class="group btn btn-outline"
				onclick={toggle}
				disabled={busy}
				aria-pressed="true"
				aria-label="Вы подписаны — нажмите, чтобы отписаться"
			>
				<span class="group-hover:hidden">Вы подписаны</span>
				<span class="hidden group-hover:inline">Отписаться</span>
			</button>
		{:else}
			<button class="btn btn-primary" onclick={toggle} disabled={busy} aria-pressed="false">
				{relation.followed_by ? 'Подписаться в ответ' : 'Подписаться'}
			</button>
		{/if}
		{#if relation.followed_by}<span class="badge badge-ghost">Читает вас</span>{/if}
	{:else if !error && !viewer.error}
		<div class="h-10 w-36 skeleton" aria-hidden="true"></div>
	{/if}
	{#if error || viewer.error}
		<span role="alert" class="text-sm text-error">{error || viewer.error}</span>
	{/if}
</div>
