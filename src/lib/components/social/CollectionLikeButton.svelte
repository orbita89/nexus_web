<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import LikeHeart from './LikeHeart.svelte';

	// «Нравится» подборке — одно сердечко, как у профиля и у человека. Дизлайк бэкенд умеет
	// (`value: -1`), но мы его не предлагаем: нужен сигнал «мне нравится», а не оценка в обе
	// стороны, и в «Что нравится» попадает именно он.
	//
	// Счётчик приходит в самой подборке (likes_count) — отдельного запроса за числом нет. А вот
	// свой голос сервер отдаёт как гостю (mine всегда null: токенов на сервере нет), поэтому
	// вошедший один раз перечитывает сводку голосов — там и свежее число, и mine.
	let {
		collection
	}: {
		collection: { id: string; likes_count: number; mine?: number | null };
	} = $props();

	// Своё состояние; до ответа с токеном — то, что пришло со страницы.
	let own = $state<{ liked: boolean; likes: number } | null>(null);
	let busy = $state(false);
	let error = $state('');

	const liked = $derived(own?.liked ?? collection.mine === 1);
	const count = $derived(own?.likes ?? collection.likes_count);

	$effect(() => {
		const id = collection.id;
		own = null;
		error = '';
		if (session.status !== 'authed') return;
		let stale = false;
		unwrap(api.social.GET('/api/v1/social/collections/{id}/likes', { params: { path: { id } } }))
			.then((summary) => {
				if (stale) return;
				own = { liked: summary.mine === 1, likes: summary.likes };
			})
			.catch((e) => !stale && (error = errorMessage(e)));
		return () => {
			stale = true;
		};
	});

	async function toggle() {
		if (busy) return;
		const before = own;
		const next = !liked;
		// Если раньше стоял дизлайк, он снимется сам — у нас его всё равно негде показать.
		own = { liked: next, likes: Math.max(0, count + (next ? 1 : -1)) };
		busy = true;
		error = '';
		const params = { path: { id: collection.id } };
		try {
			await unwrap(
				next
					? api.social.PUT('/api/v1/social/collections/{id}/like', { params, body: { value: 1 } })
					: api.social.DELETE('/api/v1/social/collections/{id}/like', { params })
			);
		} catch (e) {
			own = before;
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="inline-flex items-center gap-2">
	<LikeHeart {count} {liked} {busy} title="Нравится подборка" red={true} onclick={toggle} />
	{#if error}<p role="alert" class="text-sm text-error">{error}</p>{/if}
</div>
