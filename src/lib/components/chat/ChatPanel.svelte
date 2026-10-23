<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { session } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { authorName, roomMeta, TOPICS, unreadLabel } from '#lib/chat/rooms.ts';
	import type { Tab } from '#lib/chat/chat.svelte.ts';
	import { useRealtime, useRealtimeReplies } from '#lib/realtime/realtime.svelte.ts';
	import ChatList from './ChatList.svelte';
	import ChatRoom from './ChatRoom.svelte';
	import RoomIcon from './RoomIcon.svelte';

	// Правая панель чата на всех страницах. Десктоп (lg) — закреплена справа, сворачивается в
	// полосу с иконками; уже — выезжающий лист (открывается иконкой в шапке, chat.sheet).
	onMount(() => chat.restore());

	// Список — у вошедшего; вход, выход — перечитать.
	$effect(() => {
		void session.status;
		void chat.loadChats();
	});

	// Вошедшему — все события соединения (интересы и комнаты сервер подписывает сам).
	useRealtime(
		() => (session.status === 'authed' ? null : []),
		(event) => chat.onEvent(event),
		() => chat.resync()
	);
	// Канал общего списка комнат: новая комната появляется в «Обсуждается» без перезагрузки.
	useRealtime(
		() => ['rooms'],
		(event) => chat.onEvent(event)
	);
	// Открытая комната не из интересов (и у гостя) — подписать её канал.
	useRealtime(
		() => (chat.current && !chat.member ? [chat.current.room] : []),
		(event) => session.status !== 'authed' && chat.onEvent(event),
		() => session.status !== 'authed' && chat.resync()
	);
	useRealtimeReplies((reply) => chat.onReply(reply));

	// Мобильный лист закрывается переходом по ссылке (на карточку из шапки комнаты).
	afterNavigate(() => (chat.sheet = false));

	// Свёрнутая полоса — все чаты подряд: общие сверху (их так отдаёт бэкенд), дальше свои.
	// Без ограничения по числу: полоса прокручивается, и обрезать её — терять чаты из виду.
	const strip = $derived(chat.chats ?? []);

	const tabs: { tab: Tab; title: string }[] = [
		{ tab: 'general', title: 'Общий' },
		{ tab: 'catalog', title: 'Каталог' },
		{ tab: 'chats', title: 'Чаты' }
	];
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && chat.sheet && (chat.sheet = false)} />

<!-- Затемнение под листом (мобильная ширина). -->
{#if chat.sheet}
	<button
		class="fixed inset-0 z-40 bg-black/50 lg:hidden"
		aria-label="Закрыть чат"
		onclick={() => (chat.sheet = false)}
	></button>
{/if}

<aside
	aria-label="Чат"
	class={[
		'fixed right-0 z-50 flex flex-col border-l border-base-300 bg-base-200 transition-transform duration-200',
		'inset-y-0 w-full max-w-sm pt-[env(safe-area-inset-top)]',
		chat.sheet ? 'translate-x-0 shadow-2xl' : 'translate-x-full',
		'lg:top-16 lg:z-10 lg:max-w-none lg:translate-x-0 lg:pt-0 lg:shadow-none',
		chat.collapsed ? 'lg:w-16' : 'lg:w-80'
	]}
>
	{#if chat.collapsed}
		<!-- Свёрнута (только десктоп): последние комнаты. Развернуть — кнопкой чата в шапке. -->
		<div class="hidden flex-1 flex-col items-center gap-2 overflow-y-auto py-3 lg:flex">
			{#each strip as c (c.room)}
				{@const meta = roomMeta(c)}
				<button
					class="indicator rounded-full transition hover:scale-105"
					title={meta.title}
					aria-label={meta.title}
					onclick={() => chat.open(meta)}
				>
					{#if c.unread && !c.muted}<span class="indicator-item badge badge-xs badge-primary"
							>{unreadLabel(c.unread)}</span
						>{/if}
					<RoomIcon {meta} />
				</button>
			{/each}
		</div>
	{/if}

	<div class={['min-h-0 flex-1 flex-col', chat.collapsed ? 'flex lg:hidden' : 'flex']}>
		<div class="flex items-center justify-end gap-1 px-2 py-2">
			<p class="mr-auto pl-2 text-xs font-bold tracking-widest text-base-content/60 uppercase">
				Чат
			</p>
			<a
				href="/chat"
				class="btn btn-square btn-ghost btn-sm"
				title="Каталог комнат"
				aria-label="Каталог комнат"
			>
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
					><path
						d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
					/></svg
				>
			</a>
			<button
				class="btn hidden btn-square btn-ghost btn-sm lg:inline-flex"
				title="Свернуть"
				aria-label="Свернуть чат"
				onclick={() => chat.toggleCollapsed()}>»</button
			>
			<button
				class="btn btn-square btn-ghost btn-sm lg:hidden"
				aria-label="Закрыть чат"
				onclick={() => (chat.sheet = false)}>✕</button
			>
		</div>
		<!-- Вкладка — это сам чат: «Общий» и «Каталог» сразу показывают ленту. -->
		<div class="px-4 pb-1">
			<div class="flex rounded-full bg-base-300/60 p-1" role="tablist" aria-label="Разделы чата">
				{#each tabs as t (t.tab)}
					{@const unread = chat.unreadByTab[t.tab]}
					<button
						role="tab"
						aria-selected={chat.tab === t.tab && !chat.adhoc}
						class={[
							'flex flex-1 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[0.65rem] font-bold tracking-wider uppercase transition',
							chat.tab === t.tab && !chat.adhoc
								? 'bg-base-100 text-base-content shadow-sm'
								: 'text-base-content/50 hover:text-base-content'
						]}
						onclick={() => chat.setTab(t.tab)}
						>{t.title}{#if unread}<span
								class="badge badge-xs badge-primary"
								aria-label="Непрочитанных: {unread}">{unreadLabel(unread)}</span
							>{/if}</button
					>
				{/each}
			</div>
			{#if chat.tab === 'catalog' && !chat.adhoc}
				<div class="mt-2 flex flex-wrap gap-1" role="group" aria-label="Раздел каталога">
					{#each TOPICS as t (t.slug)}
						{@const unread = chat.unreadOf(`room:${t.slug}`)}
						<button
							class={['badge badge-sm', chat.topic === t.slug ? 'badge-primary' : 'badge-ghost']}
							aria-pressed={chat.topic === t.slug}
							onclick={() => chat.setTopic(t.slug)}
							>{t.title}{#if unread}&nbsp;<span
									class={['font-bold', chat.topic === t.slug ? '' : 'text-primary']}
									aria-label="Непрочитанных: {unread}">{unreadLabel(unread)}</span
								>{/if}</button
						>
					{/each}
				</div>
			{/if}
		</div>

		{#if chat.current}
			<ChatRoom meta={chat.current} />
		{:else}
			<ChatList />
		{/if}
	</div>
</aside>

<!-- Уведомления о новых сообщениях не в открытой комнате. -->
{#if chat.toasts.length}
	<div class="toast toast-start z-50">
		{#each chat.toasts as t (t.id)}
			<div class="alert max-w-xs bg-base-200 shadow-lg">
				<button class="flex min-w-0 items-center gap-3 text-left" onclick={() => chat.open(t.meta)}>
					<RoomIcon meta={t.meta} size="size-8" />
					<span class="min-w-0">
						<span class="flex items-center gap-1">
							{#if t.mention}
								<span class="badge shrink-0 badge-xs badge-primary">вас упомянули</span>
							{/if}
							<span class="truncate text-xs font-bold">{t.meta.title}</span>
						</span>
						<span class="block truncate text-xs text-base-content/70"
							>{t.message.author ? `${authorName(t.message.author)}: ` : ''}{t.message.body}</span
						>
					</span>
				</button>
				<button class="btn btn-ghost btn-xs" aria-label="Скрыть" onclick={() => chat.dismiss(t.id)}
					>✕</button
				>
			</div>
		{/each}
	</div>
{/if}
