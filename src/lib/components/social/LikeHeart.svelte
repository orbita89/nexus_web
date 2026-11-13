<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// Сердечко со счётчиком — один вид на все три места, где есть лайк: профиль, человек,
	// подборка. Дизлайка нет нигде: нужен сигнал «мне нравится», а не оценка в обе стороны.
	// Данные у каждого свои (у кого откуда приходит свой голос — см. сами кнопки), здесь
	// только внешний вид и три состояния: гость, только счётчик, живая кнопка.
	//
	// variant='pill' — мягкая пилюля без рамки кнопки (шапка профиля). По умолчанию — кнопка daisyUI.
	let {
		count,
		liked,
		busy = false,
		readonly = false,
		size = 'sm',
		red = false,
		variant = 'btn',
		title = 'Нравится',
		guestLabel = 'Войдите, чтобы отметить',
		onclick
	}: {
		count: number;
		liked: boolean;
		busy?: boolean;
		/** Свой профиль: лайкнуть себя нельзя, остаётся просто число. */
		readonly?: boolean;
		/** Размер кнопки: xs, sm, md, lg. */
		size?: 'xs' | 'sm' | 'md' | 'lg';
		/** Красный вариант кнопки. */
		red?: boolean;
		variant?: 'btn' | 'pill';
		title?: string;
		guestLabel?: string;
		onclick?: () => void;
	} = $props();

	const label = $derived(liked ? 'Убрать отметку «нравится»' : title);
	const baseCls = $derived(`btn gap-2 btn-${size}`);
	const activeCls = $derived(red ? 'btn-error' : liked ? 'btn-primary' : 'btn-ghost');

	const pillBase =
		'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm tabular-nums ring-1 transition-all duration-200';
	const pillIdle =
		'bg-base-100/60 text-base-content/70 ring-base-content/15 hover:text-error hover:ring-error/40';
	const pillLiked = 'bg-error/15 text-error ring-error/40';
	const pillCls = $derived(`${pillBase} ${liked ? pillLiked : pillIdle}`);
	const heartCls = $derived(
		`inline-block text-base leading-none transition-transform duration-200 ${liked ? 'scale-110' : ''}`
	);
</script>

{#if variant === 'pill'}
	{#if session.status === 'guest'}
		<a href={loginUrl(page.url)} class={pillCls} aria-label={guestLabel}>
			<span class={heartCls} aria-hidden="true">♥</span>
			<span>{count}</span>
		</a>
	{:else if readonly}
		<span class={`${pillBase} ${pillIdle} hover:text-base-content/70 hover:ring-base-content/15`}>
			<span class={heartCls} aria-hidden="true">♥</span>
			<span>{count}</span>
		</span>
	{:else}
		<button
			class={[pillCls, 'cursor-pointer active:scale-95 disabled:opacity-60']}
			disabled={busy || session.status === 'loading'}
			aria-pressed={liked}
			aria-label={label}
			{title}
			{onclick}
		>
			<span class={heartCls} aria-hidden="true">♥</span>
			<span>{count}</span>
		</button>
	{/if}
{:else if session.status === 'guest'}
	<a href={loginUrl(page.url)} class={baseCls + ' ' + activeCls} aria-label={guestLabel}>
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
		class={[baseCls, activeCls]}
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
