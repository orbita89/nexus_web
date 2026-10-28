<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import type { SchemaAttachment, SchemaUserRef } from '#lib/api/generated/social.ts';
	import { unwrap } from '#lib/api/errors.ts';
	import { guestApi, session } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { authorName, isSystemRoom, MAX_BODY, shortTime, type RoomMeta } from '#lib/chat/rooms.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import ChatMessage from './ChatMessage.svelte';
	import type { PickedEntity } from '#lib/components/social/EntityPicker.svelte';
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
		let body = text;
		if (attached.length) {
			const hrefs = attached
				.map((e) => entityHref({ kind: e.kind as any, slug: e.slug }))
				.join(' ');
			body = text.trim() ? `${text.trim()} ${hrefs}` : hrefs;
		}
		if (chat.send(body, picture)) {
			text = '';
			picture = null;
			attached = [];
			atBottom = true;
		}
	}

	// Картинка: грузим сразу при выборе, в сообщение уходит её id. До отправки видно превью.
	let picture = $state<SchemaAttachment | null>(null);
	let uploading = $state(false);
	let pictureError = $state('');
	let file = $state<HTMLInputElement>();

	async function pick(event: Event) {
		const chosen = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) file.value = '';
		if (!chosen) return;
		uploading = true;
		pictureError = '';
		try {
			picture = await chat.upload(chosen);
		} catch (e) {
			pictureError = e instanceof Error ? e.message : 'Не загрузилось';
		} finally {
			uploading = false;
		}
	}

	$effect(() => {
		if (chat.replyTo) input?.focus();
	});

	// Поиск по этой комнате: гостю тоже доступен, как и её история.
	let roomQuery = $state('');
	let roomTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (!chat.roomSearch) roomQuery = '';
	});
	function onRoomSearch() {
		clearTimeout(roomTimer);
		const q = roomQuery.trim();
		roomTimer = setTimeout(() => void chat.searchMessages(q.length >= 2 ? q : '', meta.room), 300);
	}

	// Подсказка по «@»: сначала те, кто писал в комнате, следом — поиск по всем пользователям.
	let caret = $state(0);
	let picked = $state(0);
	let attaching = $state(false);
	/** Меню скрепки: выбрать карточку или картинку. */
	let attachMenu = $state(false);
	let attached = $state<PickedEntity[]>([]);
	let searched = $state<SchemaUserRef[]>([]);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	/** Незавершённое «@имя» слева от курсора — иначе подсказывать нечего. */
	const typing = $derived.by(() => {
		const left = text.slice(0, caret);
		const m = /(^|[^\w@])@([a-zA-Z0-9_]{0,32})$/.exec(left);
		return m ? { prefix: m[2].toLowerCase(), at: caret - m[2].length - 1 } : null;
	});
	const matching = (u: SchemaUserRef, prefix: string) =>
		u.id !== session.user?.id &&
		(u.username.toLowerCase().startsWith(prefix) ||
			(u.display_name ?? '').toLowerCase().startsWith(prefix));

	const hints = $derived.by(() => {
		if (!typing) return [];
		const local = chat.participants.filter((u) => matching(u, typing.prefix));
		const rest = searched.filter(
			(u) => matching(u, typing.prefix) && !local.some((l) => l.id === u.id)
		);
		return [...local, ...rest].slice(0, 6);
	});

	// Кто писал в комнате — сразу, остальных ищем на сервере.
	$effect(() => {
		const prefix = typing?.prefix;
		picked = 0;
		clearTimeout(searchTimer);
		if (prefix === undefined || prefix.length < 1) {
			searched = [];
			return;
		}
		searchTimer = setTimeout(async () => {
			try {
				const users = await unwrap(
					guestApi.social.GET('/api/v1/social/users', {
						params: { query: { q: prefix, limit: 8 } }
					})
				);
				if (typing?.prefix === prefix) searched = users;
			} catch {
				// без подсказок по всем — останутся те, кто писал в комнате
			}
		}, 250);
		return () => clearTimeout(searchTimer);
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

	function attach(entity: PickedEntity) {
		attached = [...attached, entity];
		attaching = false;
		input?.focus();
	}

	/** Enter и стрелки сначала достаются списку подсказок. */
	function onKeydown(e: KeyboardEvent) {
		/** «#» открывает поиск карточки (как кнопка прикрепления). */
		if (e.key === '#') {
			e.preventDefault();
			attaching = true;
			return;
		}
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

	{#if chat.currentHidden}
		<!-- Чат убран из «Моих чатов», но открыт вкладкой: отсюда его и возвращают. -->
		<p class="flex items-center gap-2 border-b border-base-300 px-3 py-1.5 text-xs">
			<span class="min-w-0 flex-1 truncate text-base-content/60">Убран из «Моих чатов»</span>
			<button class="shrink-0 link link-primary" onclick={() => chat.setHidden(meta.room, false)}
				>Вернуть</button
			>
		</p>
	{/if}

	{#if chat.roomSearch}
		<!-- Поиск по этой комнате: выдача вместо ленты, пока поиск открыт. -->
		<div class="border-b border-base-300 px-2 py-2">
			<label class="input w-full input-sm">
				<input
					type="search"
					placeholder="Найти в этом чате"
					aria-label="Найти в этом чате"
					bind:value={roomQuery}
					oninput={onRoomSearch}
				/>
				{#if chat.searching}<span class="loading loading-xs loading-spinner"></span>{/if}
			</label>
		</div>
		<div class="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2 py-2">
			{#if roomQuery.trim().length < 2}
				<p class="px-2 py-6 text-sm text-base-content/60">Введите хотя бы два символа.</p>
			{:else if chat.found?.length}
				<ul class="flex flex-col gap-1">
					{#each chat.found as hit (hit.message.id)}
						<li class="rounded-box bg-base-300/40 px-3 py-2">
							<p class="flex items-baseline gap-2 text-xs">
								<span class="truncate font-bold"
									>{hit.message.author ? authorName(hit.message.author) : 'Удалено'}</span
								>
								<span class="ml-auto shrink-0 text-base-content/40"
									>{shortTime(hit.message.created_at)}</span
								>
							</p>
							<p class="text-sm break-words whitespace-pre-wrap">{hit.message.body}</p>
						</li>
					{/each}
				</ul>
			{:else if !chat.searching}
				<p class="px-2 py-6 text-sm text-base-content/60">Ничего не нашлось.</p>
			{/if}
		</div>
	{/if}

	<div
		bind:this={feed}
		class={['scrollbar-hide min-h-0 flex-1 overflow-y-auto py-2', { hidden: chat.roomSearch }]}
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
				<div class="mb-1 flex items-center gap-2 border-l-0 pl-2 text-xs">
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
			{#if picture}
				<div class="mb-1 flex items-center gap-2 rounded-box bg-base-300/60 p-1.5">
					<img
						src={picture.url}
						alt="Выбранная картинка"
						class="size-10 shrink-0 rounded object-cover"
					/>
					<span class="min-w-0 flex-1 truncate text-xs text-base-content/60"
						>{picture.width}×{picture.height}</span
					>
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						aria-label="Убрать картинку"
						onclick={() => (picture = null)}>✕</button
					>
				</div>
			{/if}
			{#if attached.length}
				<div class="mb-1 flex flex-wrap gap-2">
					{#each attached as entity, i (entity.slug + i)}
						<div class="relative inline-block">
							{#if entity.cover_url}
								<img
									src={entity.cover_url}
									alt={entity.title}
									class="size-10 rounded object-cover"
								/>
							{/if}
							<button
								type="button"
								class="btn absolute -top-1 -right-1 btn-circle bg-base-100 btn-ghost btn-xs"
								aria-label="Убрать сущность"
								onclick={() => (attached = attached.filter((_, j) => j !== i))}>✕</button
							>
						</div>
					{/each}
				</div>
			{/if}
			{#if pictureError}
				<p role="alert" class="mb-1 text-xs text-error">{pictureError}</p>
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
			<div class="flex items-center gap-2">
				<input
					bind:this={file}
					type="file"
					accept="image/*"
					class="hidden"
					aria-label="Картинка"
					onchange={pick}
				/>
				<!-- Одна скрепка на оба вложения: карточка и картинка выбираются в её меню. -->
				<div class="relative shrink-0">
					<button
						type="button"
						class={['btn btn-square btn-ghost btn-sm', { 'text-primary': attachMenu || attaching }]}
						aria-label="Прикрепить"
						title="Прикрепить"
						aria-expanded={attachMenu}
						disabled={uploading}
						onclick={() => (attachMenu = !attachMenu)}
					>
						{#if uploading}
							<span class="loading loading-xs loading-spinner"></span>
						{:else}
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
						{/if}
					</button>
					{#if attachMenu}
						<div
							class="absolute bottom-full left-0 z-30 mb-1 flex w-44 flex-col rounded-box bg-base-100 p-1 shadow-xl ring-1 ring-base-300"
						>
							<button
								type="button"
								class="rounded px-3 py-1.5 text-left text-sm hover:bg-base-300"
								onclick={() => {
									attachMenu = false;
									attaching = true;
								}}>Карточка</button
							>
							<button
								type="button"
								class="rounded px-3 py-1.5 text-left text-sm hover:bg-base-300"
								onclick={() => {
									attachMenu = false;
									file?.click();
								}}>Картинка</button
							>
						</div>
					{/if}
				</div>
				<textarea
					bind:this={input}
					bind:value={text}
					class="min-h-0 flex-1 resize-none rounded-2xl border-0 bg-base-200 px-4 py-2.5 text-sm outline-none focus:outline-none"
					rows="1"
					maxlength={MAX_BODY}
					placeholder="@люди, #контент"
					aria-label="Сообщение"
					onkeydown={onKeydown}
					onkeyup={(e) => (caret = e.currentTarget.selectionStart)}
					onclick={(e) => (caret = e.currentTarget.selectionStart)}
					oninput={(e) => (caret = e.currentTarget.selectionStart)}
					onblur={() => setTimeout(() => (caret = 0), 150)}></textarea>
				<button
					class="btn border-orange-500 bg-orange-500 text-white btn-sm hover:bg-orange-600"
					disabled={!text.trim() && !picture}>➤</button
				>
			</div>
		</form>
	{:else if session.status === 'guest'}
		<p class="border-t border-base-300 p-3 text-center text-sm">
			<a href={loginUrl(page.url)} class="link link-primary">Войдите</a>, чтобы писать в чат.
		</p>
	{/if}
</div>
