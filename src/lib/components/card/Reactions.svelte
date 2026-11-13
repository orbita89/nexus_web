<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, guestApi, session } from '#lib/auth/session.svelte.ts';
	import {
		applyReaction,
		EMOJI_PALETTE,
		isMine,
		SHOWN_REACTIONS,
		type ReactionItem
	} from '#lib/social/reactions.ts';

	// Реакции как в чате: что уже поставили — видно всем, со счётчиками; «+» открывает палитру и
	// добавляет свою. Своих может быть несколько, повторное нажатие снимает. Числа приходят одним
	// запросом (у вошедшего с «моя»), нажатие меняет их сразу, ошибка — откат и сообщение.
	let {
		slug,
		released = true,
		version = 0
	}: {
		slug: string;
		released?: boolean;
		/** Меняется при событии entity.reacted — строку перечитываем. */
		version?: number;
	} = $props();

	let items = $state<ReactionItem[]>([]);
	let busy = $state('');
	let error = $state('');
	let open = $state(false);
	let box = $state<HTMLDivElement>();

	const shown = $derived(items.slice(0, SHOWN_REACTIONS));
	const rest = $derived(Math.max(0, items.length - SHOWN_REACTIONS));
	const canReact = $derived(released && session.status === 'authed');

	// Список публичный: гостю тоже видно, кто чем ответил. С токеном в нём есть «моя».
	$effect(() => {
		const current = slug;
		void version;
		void session.status;
		let stale = false;
		unwrap(
			(session.status === 'authed' ? api : guestApi).social.GET(
				'/api/v1/social/entities/{slug}/reactions',
				{ params: { path: { slug: current } } }
			)
		)
			.then((r) => !stale && (items = r.items))
			.catch(() => {});
		return () => {
			stale = true;
		};
	});

	async function toggle(emoji: string) {
		if (busy || !canReact) return;
		const on = !isMine(items, emoji);
		const before = items;
		items = applyReaction(items, emoji, on);
		busy = emoji;
		error = '';
		const params = { path: { slug } };
		try {
			await unwrap(
				on
					? api.social.PUT('/api/v1/social/entities/{slug}/reaction', { params, body: { emoji } })
					: api.social.DELETE('/api/v1/social/entities/{slug}/reaction', {
							params,
							body: { emoji }
						})
			);
		} catch (e) {
			items = before;
			error = errorMessage(e);
		} finally {
			busy = '';
		}
	}

	function pick(emoji: string) {
		open = false;
		void toggle(emoji);
	}
</script>

<svelte:window
	onclick={(e) => {
		if (open && box && !box.contains(e.target as Node)) open = false;
	}}
	onkeydown={(e) => {
		if (open && e.key === 'Escape') open = false;
	}}
/>

<div class="flex max-w-full min-w-0 items-center gap-2 max-md:w-full md:flex-wrap" bind:this={box}>
	<div
		class="flex min-w-0 flex-wrap gap-0.5 max-md:shrink max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden md:flex-wrap"
		role="group"
		aria-label="Реакции"
	>
		{#each shown as item (item.emoji)}
			<button
				class={[
					'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-base-content/5 disabled:opacity-50',
					item.mine && 'font-semibold text-primary'
				]}
				aria-pressed={item.mine}
				aria-label="{item.emoji} — {item.count}"
				disabled={!canReact || busy === item.emoji}
				onclick={() => toggle(item.emoji)}
			>
				<span class="text-base leading-none">{item.emoji}</span>
				<span class="text-xs tabular-nums">{item.count}</span>
			</button>
		{/each}
		{#if rest}
			<span class="self-center text-xs text-base-content/50">ещё {rest}</span>
		{/if}
	</div>

	<!-- «+» — своя реакция: палитра частых эмодзи. Бэкенд принимает любой, но выбор из тысячи
	     никому не нужен; у гостя и до премьеры кнопки нет. -->
	{#if canReact}
		<div class="relative shrink-0">
			<button
				class="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center gap-0.5 rounded-md px-1 text-base-content/60 transition-colors hover:bg-base-content/5"
				aria-label="Добавить реакцию"
				aria-expanded={open}
				title="Добавить реакцию"
				onclick={() => (open = !open)}
			>
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="9" />
					<path d="M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0" stroke-linecap="round" />
				</svg>
				<span class="text-base leading-none">+</span>
			</button>
			{#if open}
				<div
					class="absolute top-full right-0 z-30 mt-2 grid w-64 max-w-[calc(100vw-2rem)] grid-cols-6 gap-1 rounded-box border border-base-300 bg-base-200 p-2 shadow-xl"
					role="group"
					aria-label="Выбор реакции"
				>
					{#each EMOJI_PALETTE as emoji (emoji)}
						<button
							class={[
								'rounded-lg p-1.5 text-xl leading-none transition hover:bg-base-300',
								isMine(items, emoji) && 'bg-primary/20'
							]}
							aria-label={emoji}
							onclick={() => pick(emoji)}>{emoji}</button
						>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
{#if error}<p role="alert" class="mt-2 text-sm text-error">{error}</p>{/if}
