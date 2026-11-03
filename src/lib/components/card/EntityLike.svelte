<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, guestApi, session } from '#lib/auth/session.svelte.ts';
	import LikeHeart from '#lib/components/social/LikeHeart.svelte';

	// Сердечко у произведения: сказать «зашло» одним нажатием. Оценка 1–10 — это рецензия, её
	// обдумывают; реакции — настроение; отметки — статус. Лайк — отдельный сигнал, он же наполняет
	// раздел «Что нравится» в профиле.
	//
	// Число приходит и в сводке оценок (likes_count), но своё — только здесь, поэтому один запрос
	// на карточку: публичный у гостя, с токеном у вошедшего.
	let { slug }: { slug: string } = $props();

	let likes = $state(0);
	let liked = $state(false);
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		const current = slug;
		void session.status;
		let stale = false;
		unwrap(
			(session.status === 'authed' ? api : guestApi).social.GET(
				'/api/v1/social/entities/{slug}/likes',
				{ params: { path: { slug: current } } }
			)
		)
			.then((r) => {
				if (stale) return;
				likes = r.likes;
				liked = r.mine;
			})
			.catch(() => {});
		return () => {
			stale = true;
		};
	});

	async function toggle() {
		if (busy) return;
		const next = !liked;
		const before = { likes, liked };
		liked = next;
		likes = Math.max(0, likes + (next ? 1 : -1));
		busy = true;
		error = '';
		const params = { path: { slug } };
		try {
			await unwrap(
				next
					? api.social.PUT('/api/v1/social/entities/{slug}/like', { params })
					: api.social.DELETE('/api/v1/social/entities/{slug}/like', { params })
			);
		} catch (e) {
			likes = before.likes;
			liked = before.liked;
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<LikeHeart
	count={likes}
	{liked}
	{busy}
	title="Нравится"
	guestLabel="Войдите, чтобы отметить"
	onclick={toggle}
/>
{#if error}<p role="alert" class="mt-2 text-sm text-error">{error}</p>{/if}
