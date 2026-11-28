<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { me } from '#lib/social/me.svelte.ts';
	import {
		applyReaction,
		EMOJI_PALETTE,
		isMine,
		SHOWN_REACTIONS,
		type ReactionItem
	} from '#lib/social/reactions.ts';

	// Реакции на человека — как у произведения (Reactions.svelte), но без запроса при открытии:
	// счётчики — из статической страницы (PersonDetail.reactions), свои — из снимка «моего».
	// Нажатие меняет строку сразу; ответ PUT/DELETE — свежие счётчики, ошибка — откат.
	let { slug, initial }: { slug: string; initial: { emoji: string; count: number }[] } = $props();

	/** Ответ последнего своего нажатия; до него — со страницы. */
	let fresh = $state<ReactionItem[] | null>(null);
	let busy = $state('');
	let error = $state('');
	let open = $state(false);
	let box = $state<HTMLDivElement>();

	$effect(() => {
		void slug;
		fresh = null;
		error = '';
	});

	const mine = $derived(session.status === 'authed' ? (me.person(slug).reactions ?? []) : []);
	const items = $derived<ReactionItem[]>(
		fresh ?? initial.map((r) => ({ ...r, mine: mine.includes(r.emoji) }))
	);
	const shown = $derived(items.slice(0, SHOWN_REACTIONS));
	const rest = $derived(Math.max(0, items.length - SHOWN_REACTIONS));
	const canReact = $derived(session.status === 'authed' && me.ready);

	async function toggle(emoji: string) {
		if (busy || !canReact) return;
		const on = !isMine(items, emoji);
		const before = { fresh, mine };
		fresh = applyReaction(items, emoji, on);
		me.patchPerson(slug, {
			reactions: on ? [...mine, emoji] : mine.filter((e) => e !== emoji)
		});
		busy = emoji;
		error = '';
		const params = { path: { slug } };
		try {
			const r = await unwrap(
				on
					? api.social.PUT('/api/v1/social/people/{slug}/reaction', { params, body: { emoji } })
					: api.social.DELETE('/api/v1/social/people/{slug}/reaction', { params, body: { emoji } })
			);
			fresh = r.items;
		} catch (e) {
			fresh = before.fresh;
			me.patchPerson(slug, { reactions: before.mine });
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
		class="flex min-w-0 flex-wrap gap-0.5 max-md:shrink max-md:[scrollbar-width:none] max-md:flex-nowrap max-md:overflow-x-auto md:flex-wrap max-md:[&::-webkit-scrollbar]:hidden"
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
