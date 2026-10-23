<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { authorName, isSystemRoom, MAX_BODY, type RoomMeta } from '#lib/chat/rooms.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import ChatMessage from './ChatMessage.svelte';
	import EntitySearchPopover from './EntitySearchPopover.svelte';
	import RoomIcon from './RoomIcon.svelte';

	// Открытая комната: шапка, лента (вверх — старые), поле ввода. Лента прилипает к низу, пока
	// пользователь внизу; последнее видимое сообщение — chat.seen (прочитано).
	let { meta }: { meta: RoomMeta } = $props();

	let feed = $state<HTMLElement>();
	let input = $state<HTMLTextAreaElement>();
	let text = $state('');
	/** Пользователь внизу ленты: новые сообщения прокручивают к себе. */
	let atBottom = true;

	const byId = $derived(new Map(chat.messages.map((m) => [m.id, m])));
	const last = $derived(chat.messages.findLast((m) => !m.clientId));
	const muted = $derived(chat.muted(meta.room));
	const system = $derived(isSystemRoom(meta.room));

	// Новые сообщения или первая страница — вниз, если были внизу.
	let count = 0;
	let prevFirst: string | undefined;
	$effect.pre(() => {
		const n = chat.messages.length;
		const first = chat.messages[0]?.id;
		if (!feed) return;
		const height = feed.scrollHeight;
		const top = feed.scrollTop;
		void tick().then(() => {
			if (!feed) return;
			if (atBottom || count === 0) feed.scrollTop = feed.scrollHeight;
			// Догрузили старые сверху — оставить взгляд на том же сообщении.
			else if (first !== prevFirst) feed.scrollTop = top + (feed.scrollHeight - height);
			prevFirst = first;
			count = n;
		});
	});

	// Комната сменилась — снова вниз.
	$effect(() => {
		void meta.room;
		atBottom = true;
		count = 0;
		text = '';
	});

	function onScroll() {
		if (!feed) return;
		atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
		if (feed.scrollTop < 80 && chat.nextBefore && !chat.historyLoading) void chat.loadHistory(true);
	}

	// Последнее сообщение на экране — прочитано (с задержкой — в chat.seen).
	let lastElement = $state<HTMLElement>();
	let bottomVisible = $state(false);
	let pageVisible = $state(true);
	$effect(() => {
		if (!lastElement) return;
		const observer = new IntersectionObserver(([entry]) => (bottomVisible = entry.isIntersecting), {
			root: feed
		});
		observer.observe(lastElement);
		return () => observer.disconnect();
	});
	// Низ ленты виден, а панель на экране — прочитано. Перепроверяем, когда открыли лист,
	// развернули панель или вернулись на вкладку: observer сам в этих случаях не срабатывает.
	$effect(() => {
		const id = last?.id;
		void chat.sheet;
		void chat.collapsed;
		if (id && bottomVisible && pageVisible && chat.watching) chat.seen(id);
	});

	function submit() {
		if (chat.send(text)) {
			text = '';
			atBottom = true;
		}
	}

	$effect(() => {
		if (chat.replyTo) input?.focus();
	});

	// Подсказка по «@»: берём тех, кто уже писал в комнате.
	let caret = $state(0);
	let picked = $state(0);
	let attaching = $state(false);

	/** Незавершённое «@имя» слева от курсора — иначе подсказывать нечего. */
	const typing = $derived.by(() => {
		const left = text.slice(0, caret);
		const m = /(^|[^\w@])@([a-zA-Z0-9_]{0,32})$/.exec(left);
		return m ? { prefix: m[2].toLowerCase(), at: caret - m[2].length - 1 } : null;
	});
	const hints = $derived(
		typing
			? chat.participants
					.filter(
						(u) =>
							u.id !== session.user?.id &&
							(u.username.toLowerCase().startsWith(typing.prefix) ||
								(u.display_name ?? '').toLowerCase().startsWith(typing.prefix))
					)
					.slice(0, 6)
			: []
	);
	$effect(() => {
		void typing?.prefix;
		picked = 0;
	});

	function mention(username: string) {
		if (!typing) return;
		const before = text.slice(0, typing.at);
		const after = text.slice(caret);
		text = `${before}@${username} ${after.startsWith(' ') ? after.slice(1) : after}`;
		const at = typing.at + username.length + 2;
		void tick().then(() => input?.setSelectionRange(at, at));
		input?.focus();
	}

	function attach(href: string) {
		text = text.trim() ? `${text.trim()} ${href}` : href;
		attaching = false;
		input?.focus();
	}

	/** Enter и стрелки сначала достаются списку подсказок. */
	function onKeydown(e: KeyboardEvent) {
		if (hints.length) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				picked = (picked + (e.key === 'ArrowDown' ? 1 : hints.length - 1)) % hints.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				mention(hints[picked].username);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				caret = 0;
				return;
			}
		}
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}
</script>

<svelte:document onvisibilitychange={() => (pageVisible = !document.hidden)} />

<div class="flex min-h-0 flex-1 flex-col">
	<!-- У системного чата шапки нет: название уже написано на вкладке, а заглушать его нечего. -->
	{#if !system}
		<header class="flex items-center gap-2 border-b border-base-300 px-2 pb-2">
			{#if chat.adhoc}
				<button
					class="btn btn-square btn-ghost btn-sm"
					aria-label="Назад"
					onclick={() => chat.back()}>‹</button
				>
			{/if}
			<RoomIcon {meta} size="size-8" />
			<div class="min-w-0 flex-1">
				{#if meta.href}
					<a href={meta.href} class="block truncate text-sm font-bold hover:underline"
						>{meta.title}</a
					>
				{:else}
					<p class="truncate text-sm font-bold">{meta.title}</p>
				{/if}
			</div>
			{#if chat.info?.me && chat.info.room === meta.room}
				{@const room = meta.room.startsWith('room:')}
				<button
					class={['btn rounded-full btn-xs', chat.info.me.member ? 'btn-ghost' : 'btn-primary']}
					aria-pressed={chat.info.me.member}
					onclick={() => chat.toggleMember()}
					>{chat.info.me.member
						? room
							? 'Выйти'
							: 'Вы следите'
						: room
							? 'Вступить'
							: 'Следить'}</button
				>
			{/if}
			{#if session.status === 'authed'}
				<button
					class={['btn btn-square btn-ghost btn-sm', { 'text-base-content/40': muted }]}
					aria-pressed={muted}
					aria-label={muted ? 'Вернуть уведомления' : 'Заглушить'}
					title={muted ? 'Вернуть уведомления' : 'Заглушить'}
					onclick={() => chat.toggleMute()}
				>
					<svg
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						{#if muted}
							<path
								d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17 17 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M2 2l20 20M18 8a6 6 0 0 0-9.3-5"
							/>
						{:else}
							<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
						{/if}
					</svg>
				</button>
			{/if}
		</header>
	{/if}

	<div
		bind:this={feed}
		class="min-h-0 flex-1 overflow-y-auto py-2"
		onscroll={onScroll}
		aria-live="polite"
	>
		{#if chat.historyLoading && !chat.messages.length}
			<p class="flex justify-center py-6">
				<span class="loading loading-sm loading-spinner"></span>
			</p>
		{:else if chat.nextBefore}
			<p class="flex justify-center py-2">
				{#if chat.historyLoading}
					<span class="loading loading-xs loading-spinner"></span>
				{:else}
					<button class="btn btn-ghost btn-xs" onclick={() => chat.loadHistory(true)}>Раньше</button
					>
				{/if}
			</p>
		{:else if chat.messages.length}
			<p class="py-2 text-center text-xs text-base-content/40">Начало чата</p>
		{/if}
		{#if chat.missing}
			<p class="px-4 py-10 text-center text-sm text-base-content/50">
				{isSystemRoom(meta.room)
					? 'Этот чат ещё не создан. Администратор заводит его в админке чата.'
					: 'Чат не найден — возможно, его удалили.'}
			</p>
		{:else if chat.historyError}
			<p role="alert" class="px-3 py-2 text-sm text-error">
				{chat.historyError}
				<button class="link" onclick={() => chat.loadHistory()}>Повторить</button>
			</p>
		{/if}
		{#if !chat.historyLoading && !chat.historyError && !chat.missing && !chat.messages.length}
			<p class="px-4 py-10 text-center text-sm text-base-content/50">
				Сообщений пока нет — начните разговор.
			</p>
		{/if}
		{#each chat.messages as item, i (item.clientId ?? item.id)}
			{#if chat.readMark && i > 0 && chat.messages[i - 1].id === chat.readMark}
				<p class="divider my-1 px-3 text-xs font-bold text-primary">Новые</p>
			{/if}
			{#if item === last}
				<div bind:this={lastElement}>
					<ChatMessage {item} quoted={item.reply_to ? byId.get(item.reply_to) : null} />
				</div>
			{:else}
				<ChatMessage {item} quoted={item.reply_to ? byId.get(item.reply_to) : null} />
			{/if}
		{/each}
	</div>

	{#if chat.missing}
		<!-- Писать некуда: комнаты нет. -->
	{:else if session.status === 'authed'}
		<form
			class="border-t border-base-300 p-2"
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			{#if chat.replyTo}
				<div class="mb-1 flex items-center gap-2 border-l-2 border-primary pl-2 text-xs">
					<span class="min-w-0 flex-1 truncate text-base-content/60">
						Ответ <b>{chat.replyTo.author ? authorName(chat.replyTo.author) : ''}</b>: {chat.replyTo
							.body}
					</span>
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						aria-label="Не отвечать"
						onclick={() => (chat.replyTo = null)}>✕</button
					>
				</div>
			{/if}
			{#if attaching}
				<EntitySearchPopover onpick={attach} onclose={() => (attaching = false)} />
			{/if}
			{#if hints.length}
				<ul class="mb-1 rounded-box bg-base-300/60 p-1" aria-label="Кого упомянуть">
					{#each hints as user, i (user.id)}
						<li>
							<button
								type="button"
								class={[
									'w-full truncate rounded px-2 py-1 text-left text-xs',
									i === picked ? 'bg-base-100 font-bold' : 'hover:bg-base-100'
								]}
								onclick={() => mention(user.username)}
								>@{user.username}
								{#if user.display_name}<span class="text-base-content/50"
										>· {user.display_name}</span
									>{/if}</button
							>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="flex items-end gap-2">
				<button
					type="button"
					class={['btn btn-square btn-ghost btn-sm', { 'text-primary': attaching }]}
					aria-label="Прикрепить карточку"
					title="Прикрепить карточку"
					aria-pressed={attaching}
					onclick={() => (attaching = !attaching)}
				>
					<svg
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						><path
							d="M21.4 11.1 12.3 20a5 5 0 0 1-7.1-7.1l9.2-9.2a3.3 3.3 0 1 1 4.7 4.7l-9.2 9.2a1.7 1.7 0 0 1-2.4-2.4l8.5-8.5"
						/></svg
					>
				</button>
				<textarea
					bind:this={input}
					bind:value={text}
					class="textarea min-h-0 flex-1 resize-none textarea-sm"
					rows="1"
					maxlength={MAX_BODY}
					placeholder="Сообщение"
					aria-label="Сообщение"
					onkeydown={onKeydown}
					onkeyup={(e) => (caret = e.currentTarget.selectionStart)}
					onclick={(e) => (caret = e.currentTarget.selectionStart)}
					oninput={(e) => (caret = e.currentTarget.selectionStart)}
					onblur={() => setTimeout(() => (caret = 0), 150)}></textarea>
				<button class="btn btn-primary btn-sm" disabled={!text.trim()}>Отправить</button>
			</div>
		</form>
	{:else if session.status === 'guest'}
		<p class="border-t border-base-300 p-3 text-center text-sm">
			<a href={loginUrl(page.url)} class="link link-primary">Войдите</a>, чтобы писать в чат.
		</p>
	{/if}
</div>
