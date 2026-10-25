<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import type { ProfileViewer } from '#lib/social/profile-viewer.svelte.ts';
	import LikeHeart from './LikeHeart.svelte';

	// «Нравится» в шапке профиля: лайк один, дизлайка нет и не будет. Счётчик и `liked` приходят
	// в самой шапке — отдельного запроса под кнопку не нужно; вошедшему `liked` уточняет
	// перечитанный с токеном профиль (ProfileViewer, он же обслуживает «Подписаться»).
	//
	// Нажатие меняет счётчик сразу, ошибка — откат. Рейтинг («карма») при этом не трогаем: он
	// пересчитывается раз в сутки целиком, и анимировать score после лайка нечему.
	let {
		username,
		count,
		viewer,
		size = 'sm',
		red = false
	}: {
		username: string;
		/** likes_count из шапки (серверный, как для гостя). */
		count: number;
		viewer: ProfileViewer;
		/** Размер кнопки: xs, sm, md, lg. */
		size?: 'xs' | 'sm' | 'md' | 'lg';
		/** Красный вариант кнопки. */
		red?: boolean;
	} = $props();

	// Своё состояние после нажатия; до него — то, что пришло с перечитанным профилем.
	let changed = $state<{ liked: boolean; delta: number } | null>(null);
	let busy = $state(false);
	let error = $state('');

	const liked = $derived(changed?.liked ?? viewer.profile?.liked ?? false);
	const shown = $derived(Math.max(0, count + (changed?.delta ?? 0)));

	$effect(() => {
		void viewer.profile;
		changed = null;
	});

	async function toggle() {
		const next = !liked;
		const before = changed;
		changed = { liked: next, delta: (changed?.delta ?? 0) + (next ? 1 : -1) };
		busy = true;
		error = '';
		const params = { path: { username } };
		try {
			await unwrap(
				next
					? api.social.PUT('/api/v1/social/users/{username}/like', { params })
					: api.social.DELETE('/api/v1/social/users/{username}/like', { params })
			);
		} catch (e) {
			changed = before;
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="inline-flex items-center gap-2">
	<!-- Себе лайк не поставить (бэкенд отвечает 400 like_self) — у себя остаётся только счётчик. -->
	<LikeHeart
		count={shown}
		{liked}
		{busy}
		{size}
		{red}
		readonly={viewer.own}
		guestLabel="Войдите, чтобы отметить профиль"
		onclick={toggle}
	/>
	{#if error}<span role="alert" class="text-sm text-error">{error}</span>{/if}
</div>
