<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { me } from '#lib/social/me.svelte.ts';
	import LikeHeart from './LikeHeart.svelte';

	// «Нравится» человеку: лайк один, дизлайка у людей нет. По лайкам режиссёру или автору
	// видно, кто в почёте, а сам пользователь потом найдёт их в «Статистике» → «Что нравится».
	//
	// Число — со статической страницы (PersonDetail.likes_count; после лайка бэкенд её
	// перерисовывает), свой лайк — из снимка «моего» (me.svelte.ts). Запросов при открытии нет.
	let { slug, likesCount }: { slug: string; likesCount: number; liked?: boolean } = $props();

	/** Свои нажатия на этой странице: страница могла ещё не перерисоваться. */
	let delta = $state(0);
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		void slug;
		delta = 0;
		error = '';
	});

	const mine = $derived(session.status === 'authed' && !!me.person(slug).liked);
	const shown = $derived(Math.max(0, likesCount + delta));

	async function toggle() {
		if (busy) return;
		const next = !mine;
		me.patchPerson(slug, { liked: next });
		delta += next ? 1 : -1;
		busy = true;
		error = '';
		const params = { path: { slug } };
		try {
			await unwrap(
				next
					? api.social.PUT('/api/v1/social/people/{slug}/like', { params })
					: api.social.DELETE('/api/v1/social/people/{slug}/like', { params })
			);
		} catch (e) {
			me.patchPerson(slug, { liked: !next });
			delta -= next ? 1 : -1;
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<LikeHeart redHeart count={shown} liked={mine} {busy} onclick={toggle} />
{#if error}<span role="alert" class="text-sm text-error">{error}</span>{/if}
