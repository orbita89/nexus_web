<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, guestApi, session } from '#lib/auth/session.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import { HERO_ICON } from './buttons.ts';

	// Сердечко у произведения: сказать «зашло» одним нажатием. Оценка 1–10 — это рецензия, её
	// обдумывают; реакции — настроение; отметки — статус. Лайк — отдельный сигнал, он же наполняет
	// раздел «Что нравится» в профиле.
	//
	// Вид — круглая иконка в один ряд с закладкой и чатом (оранжевая пилюля с числом выбивалась из
	// ряда и спорила с «Оценить»), число — приглушённым счётчиком рядом, как у реакций.
	let { slug }: { slug: string } = $props();

	let likes = $state(0);
	let liked = $state(false);
	let busy = $state(false);
	let error = $state('');

	const label = $derived(liked ? 'Убрать отметку «нравится»' : 'Нравится');

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

{#snippet heart(on: boolean)}
	<svg
		class="size-5"
		viewBox="0 0 24 24"
		fill={on ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		><path
			d="M20.8 6.6a5 5 0 0 0-8.8-1.6 5 5 0 0 0-8.8 1.6c-.8 2.5.5 4.8 2.3 6.6l6.5 6.2 6.5-6.2c1.8-1.8 3.1-4.1 2.3-6.6z"
		/></svg
	>
{/snippet}

<span class="inline-flex items-center gap-1.5">
	{#if session.status === 'guest'}
		<a
			href={loginUrl(page.url)}
			class={HERO_ICON}
			aria-label="Войдите, чтобы отметить"
			title="Нравится">{@render heart(false)}</a
		>
	{:else}
		<button
			class={[
				HERO_ICON,
				'transition active:scale-90',
				liked && 'border-error/50 bg-error/15 text-error hover:border-error/70 hover:bg-error/25'
			]}
			disabled={busy || session.status === 'loading'}
			aria-pressed={liked}
			aria-label={label}
			title={label}
			onclick={toggle}>{@render heart(liked)}</button
		>
	{/if}
	{#if likes}<span class="text-xs text-base-content/60 tabular-nums">{likes}</span>{/if}
</span>
{#if error}<p role="alert" class="mt-2 text-sm text-error">{error}</p>{/if}
