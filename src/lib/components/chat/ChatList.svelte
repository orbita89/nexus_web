<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { count } from '#lib/catalog/labels.ts';
	import {
		activityLabel,
		authorName,
		isSystemRoom,
		roomMeta,
		shortTime,
		unreadLabel
	} from '#lib/chat/rooms.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import RoomIcon from './RoomIcon.svelte';

	// «Мои чаты» — единственный список панели: всё, где я состою, вперемешку — чаты фильмов,
	// людей и тем из интересов и комнаты, в которые я вступил. Ниже — живые комнаты, куда
	// можно зайти. Общий чат и чаты разделов — отдельные вкладки, они не списки.
	let query = $state('');

	const matches = (title: string) => title.toLowerCase().includes(query.trim().toLowerCase());

	const rows = $derived(
		(chat.chats ?? [])
			.filter((c) => !isSystemRoom(c.room))
			.map((c) => ({ chat: c, meta: roomMeta(c) }))
			.filter(({ meta }) => matches(meta.title))
	);

	// Куда ещё можно зайти: активные комнаты, в которых я не состою.
	$effect(() => {
		void chat.chats;
		void chat.loadSuggested();
	});
	const suggested = $derived(
		(chat.suggested ?? [])
			.filter((r) => !isSystemRoom(`room:${r.slug}`))
			.filter((r) => !rows.some(({ chat: c }) => c.custom?.slug === r.slug))
			.filter((r) => matches(r.title))
	);

	const roomMetaOf = (room: { slug: string; title: string }) => ({
		room: `room:${room.slug}`,
		title: room.title,
		href: '/chat',
		image: null
	});
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class="px-4 pt-2">
		<label class="input w-full input-sm">
			<input type="search" placeholder="Найти чат" bind:value={query} aria-label="Найти чат" />
			<svg
				class="size-4 opacity-50"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
			>
		</label>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-2">
		{#if chat.chatsError}
			<p role="alert" class="px-2 py-4 text-sm text-error">
				{chat.chatsError}
				<button class="link" onclick={() => chat.loadChats()}>Повторить</button>
			</p>
		{/if}

		{#if session.status === 'authed' && !chat.chats}
			{#each [1, 2, 3] as i (i)}
				<div class="flex items-center gap-3 px-2 py-2">
					<span class="size-10 skeleton rounded-full"></span>
					<span class="h-8 flex-1 skeleton"></span>
				</div>
			{/each}
		{:else if rows.length}
			<p
				class="px-2 pt-2 pb-1 text-[0.65rem] font-bold tracking-widest text-base-content/50 uppercase"
			>
				Мои чаты&nbsp;({rows.length})
			</p>
			<ul>
				{#each rows as { chat: c, meta } (c.room)}
					{@const last = c.last_message}
					<li>
						<button
							class="flex w-full items-center gap-3 rounded-box px-2 py-2 text-left transition hover:bg-base-300/60"
							onclick={() => chat.open(meta)}
						>
							<span class="relative">
								<RoomIcon {meta} />
								{#if c.unread && !c.muted}
									<span
										class="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-success ring-2 ring-base-200"
									></span>
								{/if}
							</span>
							<span class="min-w-0 flex-1">
								<span class="flex items-baseline gap-2">
									<span class="truncate text-sm font-bold">{meta.title}</span>
									{#if c.muted}
										<svg
											class="size-3.5 shrink-0 opacity-50"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											aria-label="Заглушён"
											role="img"
											><path
												d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17 17 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M2 2l20 20M18 8a6 6 0 0 0-9.3-5"
											/></svg
										>
									{/if}
									{#if last}
										<span class="ml-auto shrink-0 text-xs text-base-content/40"
											>{shortTime(last.created_at)}</span
										>
									{/if}
								</span>
								<span class="flex items-center gap-2">
									<span class="truncate text-xs text-base-content/50">
										{#if !last}
											Сообщений пока нет
										{:else if last.deleted}
											Сообщение удалено
										{:else}
											{last.author ? `${authorName(last.author)}: ` : ''}{last.body}
										{/if}
									</span>
									{#if c.unread}
										<span
											class={[
												'ml-auto badge shrink-0 badge-xs font-bold',
												c.muted ? 'badge-ghost' : 'badge-primary'
											]}
											aria-label="Непрочитанных: {c.unread}">{unreadLabel(c.unread)}</span
										>
									{/if}
								</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if chat.suggested === null}
			{#each [1, 2] as i (i)}
				<div class="flex items-center gap-3 px-2 py-2">
					<span class="size-10 skeleton rounded-full"></span>
					<span class="h-8 flex-1 skeleton"></span>
				</div>
			{/each}
		{:else if suggested.length}
			<p
				class="px-2 pt-4 pb-1 text-[0.65rem] font-bold tracking-widest text-base-content/50 uppercase"
			>
				Сейчас обсуждают
			</p>
			<ul>
				{#each suggested as room (room.id)}
					{@const meta = roomMetaOf(room)}
					{@const activity = activityLabel(room)}
					<li>
						<button
							class="flex w-full items-center gap-3 rounded-box px-2 py-2 text-left transition hover:bg-base-300/60"
							onclick={() => chat.open(meta)}
						>
							<RoomIcon {meta} />
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-bold">{room.title}</span>
								<span class="block truncate text-xs text-base-content/50">
									{activity ?? count(room.members_count, ['участник', 'участника', 'участников'])}
								</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else if !rows.length}
			<p class="px-2 py-6 text-sm text-base-content/60">
				{query.trim()
					? 'Ничего не нашлось.'
					: 'Добавьте фильмы, людей или темы в интересы, вступите в комнату — чаты появятся здесь.'}
			</p>
		{/if}

		{#if session.status === 'guest'}
			<p class="px-2 py-4 text-xs text-base-content/50">
				<a href={loginUrl(page.url)} class="link link-primary">Войдите</a>, чтобы видеть свои чаты,
				вступать в комнаты и писать.
			</p>
		{/if}
	</div>

	<p class="border-t border-base-300 px-4 py-3 text-xs text-base-content/60">
		<a href="/chat" class="link link-primary">Каталог комнат</a> — все комнаты Nexus.
	</p>
</div>
