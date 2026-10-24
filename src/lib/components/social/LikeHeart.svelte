<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// Сердечко со счётчиком — один вид на все три места, где есть лайк: профиль, человек,
	// подборка. Дизлайка нет нигде: нужен сигнал «мне нравится», а не оценка в обе стороны.
	// Данные у каждого свои (у кого откуда приходит свой голос — см. сами кнопки), здесь
	// только внешний вид и три состояния: гость, только счётчик, живая кнопка.
	let {
		count,
		liked,
		busy = false,
		readonly = false,
		title = 'Нравится',
		guestLabel = 'Войдите, чтобы отметить',
		onclick
	}: {
		count: number;
		liked: boolean;
		busy?: boolean;
		/** Свой профиль: лайкнуть себя нельзя, остаётся просто число. */
		readonly?: boolean;
		title?: string;
		guestLabel?: string;
		onclick?: () => void;
	} = $props();

	const label = $derived(liked ? 'Убрать отметку «нравится»' : title);
</script>

{#if session.status === 'guest'}
	<a href={loginUrl(page.url)} class="btn gap-2 btn-ghost btn-sm" aria-label={guestLabel}>
		<span aria-hidden="true">♥</span>
		<span class="tabular-nums">{count}</span>
	</a>
{:else if readonly}
	<span class="flex items-center gap-2 px-2 text-sm text-base-content/60">
		<span aria-hidden="true">♥</span>
		<span class="tabular-nums">{count}</span>
	</span>
{:else}
	<button
		class={['btn gap-2 btn-sm', liked ? 'btn-primary' : 'btn-ghost']}
		disabled={busy || session.status === 'loading'}
		aria-pressed={liked}
		aria-label={label}
		{title}
		{onclick}
	>
		<span aria-hidden="true">♥</span>
		<span class="tabular-nums">{count}</span>
	</button>
{/if}
