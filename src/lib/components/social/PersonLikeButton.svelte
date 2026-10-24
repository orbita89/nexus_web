<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import LikeHeart from './LikeHeart.svelte';

	// «Нравится» человеку: лайк один, дизлайка у людей нет. По лайкам режиссёру или автору
	// видно, кто в почёте, а сам пользователь потом найдёт их в «Статистике» → «Что нравится».
	//
	// likes_count и liked приходят в самой карточке человека (PersonDetail из catalog), но
	// сервер рендерит страницу как для гостя — там liked всегда false. Поэтому вошедший
	// перечитывает карточку с токеном: отдельного «мой лайк» в API нет, а список лайкнувших
	// (GET …/people/{slug}/likes) ради одной проверки листать не стоит.
	let {
		slug,
		likesCount,
		liked
	}: {
		slug: string;
		likesCount: number;
		/** Из PersonDetail: с сервера — всегда как у гостя. */
		liked: boolean;
	} = $props();

	// Своё состояние; до ответа с токеном — то, что пришло со страницы.
	let own = $state<{ liked: boolean; delta: number } | null>(null);
	let busy = $state(false);
	let error = $state('');

	const mine = $derived(own?.liked ?? liked);
	const shown = $derived(Math.max(0, likesCount + (own?.delta ?? 0)));

	$effect(() => {
		const current = slug;
		own = null;
		error = '';
		if (session.status !== 'authed') return;
		let stale = false;
		unwrap(
			api.catalog.GET('/api/v1/catalog/people/{slug}', { params: { path: { slug: current } } })
		)
			.then((person) => {
				if (stale) return;
				own = { liked: person.liked, delta: person.likes_count - likesCount };
			})
			.catch((e) => !stale && (error = errorMessage(e)));
		return () => {
			stale = true;
		};
	});

	async function toggle() {
		if (busy) return;
		const before = own;
		const next = !mine;
		own = { liked: next, delta: (own?.delta ?? 0) + (next ? 1 : -1) };
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
			own = before;
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<LikeHeart count={shown} liked={mine} {busy} onclick={toggle} />
{#if error}<span role="alert" class="text-sm text-error">{error}</span>{/if}
