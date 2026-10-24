<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import type { ProfileViewer } from '#lib/social/profile-viewer.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// «Нравится» в шапке профиля: лайк один, дизлайка нет и не будет. Счётчик и `liked` приходят
	// в самой шапке — отдельного запроса под кнопку не нужно; вошедшему `liked` уточняет
	// перечитанный с токеном профиль (ProfileViewer, он же обслуживает «Подписаться»).
	//
	// Нажатие меняет счётчик сразу, ошибка — откат. Рейтинг («карма») при этом не трогаем: он
	// пересчитывается раз в сутки целиком, и анимировать score после лайка нечему.
	let {
		username,
		count,
		viewer
	}: {
		username: string;
		/** likes_count из шапки (серверный, как для гостя). */
		count: number;
		viewer: ProfileViewer;
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

<div class="flex flex-wrap items-center justify-end gap-2">
	{#if session.status === 'guest'}
		<a
			href={loginUrl(page.url)}
			class="btn gap-2 btn-ghost btn-sm"
			aria-label="Войдите, чтобы отметить профиль"
		>
			<span aria-hidden="true">♥</span>
			<span class="tabular-nums">{shown}</span>
		</a>
	{:else if viewer.own}
		<!-- Себе лайк не поставить (бэкенд отвечает 400 like_self) — показываем только счётчик. -->
		<span class="flex items-center gap-2 px-2 text-sm text-base-content/60">
			<span aria-hidden="true">♥</span>
			<span class="tabular-nums">{shown}</span>
		</span>
	{:else}
		<button
			class={['btn gap-2 btn-sm', liked ? 'btn-primary' : 'btn-ghost']}
			disabled={busy || session.status === 'loading'}
			aria-pressed={liked}
			aria-label={liked ? 'Убрать отметку «нравится»' : 'Нравится'}
			title={liked ? 'Убрать отметку «нравится»' : 'Нравится'}
			onclick={toggle}
		>
			<span aria-hidden="true">♥</span>
			<span class="tabular-nums">{shown}</span>
		</button>
	{/if}
	{#if error}<span role="alert" class="text-sm text-error">{error}</span>{/if}
</div>
