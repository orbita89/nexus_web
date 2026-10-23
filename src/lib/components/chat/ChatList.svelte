<script lang="ts">
	import { page } from '$app/state';
	import { session } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { activityLabel, authorName, roomMeta, shortTime, unreadLabel } from '#lib/chat/rooms.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import RoomIcon from './RoomIcon.svelte';

	// Вкладка «Чаты» с переключателем: «Мои» — всё, где я состою (чаты фильмов, людей и тем
	// из интересов и комнаты, куда вступил), «Обсуждается» — живые комнаты, куда можно зайти.
	// Общий чат и чаты разделов — отдельные вкладки, они не списки.
	let query = $state('');

	const live = $derived(chat.listView === 'live');
	const searchLabel = $derived(live ? 'Найти комнату' : 'Найти чат');

	const matches = (title: string) => title.toLowerCase().includes(query.trim().toLowerCase());

	const rows = $derived(
		(chat.chats ?? [])
			.filter((c) => !c.custom?.system)
			.map((c) => ({ chat: c, meta: roomMeta(c) }))
			.filter(({ meta }) => matches(meta.title))
	);

	// «Обсуждается» — поиск по комнатам на сервере, «Мои чаты» — по сообщениям.
	// Своя строка чатов фильтруется на месте: она уже загружена целиком.
	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const q = query.trim();
		const mode = chat.listView;
		clearTimeout(timer);
		timer = setTimeout(
			() => {
				if (mode === 'live') void chat.loadSuggested(q);
				else void chat.searchMessages(q.length >= 2 ? q : '');
			},
			q ? 300 : 0
		);
		return () => clearTimeout(timer);
	});
	/** Свои комнаты — независимо от поиска, иначе при вводе они полезут в «Обсуждается». */
	const joined = $derived((chat.chats ?? []).map((c) => c.custom?.slug).filter(Boolean));
	const suggested = $derived(
		(chat.suggested ?? []).filter((r) => !r.system).filter((r) => !joined.includes(r.slug))
	);

	// Крестик в строке: убрать чат из своих. Обратимо — «Следить» в шапке комнаты вернёт.
	let leaving = $state('');
	async function remove(room: string) {
		leaving = room;
		try {
			await chat.leave(room);
		} finally {
			leaving = '';
		}
	}

	const roomMetaOf = (room: { slug: string; title: string }) => ({
		room: `room:${room.slug}`,
		title: room.title,
		href: '/chat',
		image: null
	});
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class="px-4 pt-2">
		<div class="flex gap-1" role="group" aria-label="Какие чаты показывать">
			<button
				class={['btn flex-1 rounded-full btn-xs', live ? 'btn-ghost' : 'btn-primary']}
				aria-pressed={!live}
				onclick={() => chat.setListView('mine')}>Мои чаты</button
			>
			<button
				class={['btn flex-1 rounded-full btn-xs', live ? 'btn-primary' : 'btn-ghost']}
				aria-pressed={live}
				onclick={() => chat.setListView('live')}>Обсуждается</button
			>
		</div>
		<label class="input mt-2 w-full input-sm">
			<input type="search" placeholder={searchLabel} bind:value={query} aria-label={searchLabel} />
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

		{#if live}
			<!-- Второй режим — живые комнаты, он ниже. -->
		{:else if session.status === 'authed' && !chat.chats}
			{#each [1, 2, 3] as i (i)}
				<div class="flex items-center gap-3 px-2 py-2">
					<span class="size-10 skeleton rounded-full"></span>
					<span class="h-8 flex-1 skeleton"></span>
				</div>
			{/each}
		{:else if rows.length}
			<ul>
				{#each rows as { chat: c, meta } (c.room)}
					{@const last = c.last_message}
					<li class="group flex items-center rounded-box pr-1 transition hover:bg-base-300/60">
						<button
							class="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
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
						<button
							class="btn btn-square shrink-0 btn-ghost opacity-0 transition btn-xs group-hover:opacity-60 hover:!opacity-100 focus-visible:opacity-100"
							aria-label={c.kind === 'room' ? `Выйти: ${meta.title}` : `Не следить: ${meta.title}`}
							title={c.kind === 'room' ? 'Выйти из комнаты' : 'Не следить'}
							disabled={leaving === c.room}
							onclick={() => remove(c.room)}>✕</button
						>
					</li>
				{/each}
			</ul>
		{:else if !query.trim()}
			<p class="px-2 py-6 text-sm text-base-content/60">
				Добавьте фильмы, людей или темы в интересы, вступите в комнату — чаты появятся здесь.
			</p>
		{/if}

		<!-- Поиск по сообщениям моих чатов: отдельным блоком под списком. -->
		{#if !live && query.trim().length >= 2}
			<p
				class="px-2 pt-4 pb-1 text-[0.65rem] font-bold tracking-widest text-base-content/50 uppercase"
			>
				Сообщения{#if chat.searching}&nbsp;<span class="loading loading-xs loading-spinner"
					></span>{/if}
			</p>
			{#if chat.found?.length}
				<ul>
					{#each chat.found as hit (hit.message.id)}
						{@const meta = chat.metaFor(hit.room)}
						<li>
							<button
								class="flex w-full items-center gap-3 rounded-box px-2 py-2 text-left transition hover:bg-base-300/60"
								onclick={() => chat.open(meta)}
							>
								<RoomIcon {meta} />
								<span class="min-w-0 flex-1">
									<span class="flex items-baseline gap-2">
										<span class="truncate text-sm font-bold">{meta.title}</span>
										<span class="ml-auto shrink-0 text-xs text-base-content/40"
											>{shortTime(hit.message.created_at)}</span
										>
									</span>
									<span class="block truncate text-xs text-base-content/50">
										{hit.message.author ? `${authorName(hit.message.author)}: ` : ''}{hit.message
											.body}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if !chat.searching}
				<p class="px-2 py-3 text-sm text-base-content/60">Ничего не нашлось.</p>
			{/if}
		{/if}

		{#if !live}
			<!-- Мои чаты уже показаны выше. -->
		{:else if chat.suggested === null}
			{#each [1, 2, 3] as i (i)}
				<div class="flex items-center gap-3 px-2 py-2">
					<span class="size-10 skeleton rounded-full"></span>
					<span class="h-8 flex-1 skeleton"></span>
				</div>
			{/each}
		{:else if suggested.length}
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
		{:else if live}
			<p class="px-2 py-6 text-sm text-base-content/60">
				{query.trim() ? 'Комнат не нашлось.' : 'Сейчас нигде не обсуждают — загляните позже.'}
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
