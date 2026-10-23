<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
	import { slugError, slugify } from '#lib/admin/slug.ts';
	import type { SchemaCustomRoom } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { count } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import RoomIcon from '#lib/components/chat/RoomIcon.svelte';
	import { HERO_GLASS } from '#lib/components/card/buttons.ts';
	import { activityLabel, ROOM_SORTS } from '#lib/chat/rooms.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import type { PageProps } from './$types';

	// Каталог комнат: «Вступить» — комната в «Моих чатах» и канал подписан; «Выйти» — наоборот.
	// Вступил ли — поле joined (у вошедшего; на сервере страница рендерится как для гостя).
	let { data }: PageProps = $props();

	let busy = $state('');
	let error = $state('');

	// Загрузка страницы — без токена (joined: null); вошедшему каталог перечитывается с токеном.
	let mine = $state<SchemaCustomRoom[] | null>(null);
	$effect(() => {
		if (session.status !== 'authed') return;
		const { sort, q } = data;
		unwrap(
			api.social.GET('/api/v1/social/chat/rooms', {
				params: { query: { limit: 100, sort, q: q || undefined } }
			})
		)
			.then((page) => (mine = page.items))
			.catch(() => {});
	});
	const rooms = $derived(mine ?? data.rooms.data?.items ?? []);

	// Поиск по комнатам — на сервере: в адресе, чтобы ссылка на выдачу работала.
	let search = $derived(data.q);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function onSearch() {
		clearTimeout(searchTimer);
		const q = search.trim();
		const sort = data.sort;
		searchTimer = setTimeout(() => {
			const query = q ? `?q=${encodeURIComponent(q)}` : sort !== 'active' ? `?sort=${sort}` : '';
			void goto(`/chat${query}`);
		}, 300);
	}

	// Своя комната: создаёт любой вошедший. slug подставляется из названия, но правится руками —
	// он навсегда, это адрес канала room:<slug>.
	let creating = $state(false);
	let draft = $state({ title: '', slug: '', description: '' });
	let slugTouched = $state(false);
	let createError = $state('');
	let saving = $state(false);

	function invalid() {
		const title = draft.title.trim();
		if (!title) return 'Введите название.';
		if (title.length > 100) return 'Название — не длиннее 100 символов.';
		if (draft.description.trim().length > 500) return 'Описание — не длиннее 500 символов.';
		if (draft.slug.trim().length > 80) return 'slug — не длиннее 80 символов.';
		return slugError(draft.slug.trim()) ?? '';
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		createError = invalid();
		if (createError) return;
		const body = {
			title: draft.title.trim(),
			slug: draft.slug.trim(),
			description: draft.description.trim() || null
		};
		saving = true;
		try {
			const room = await unwrap(api.social.POST('/api/v1/social/chat/rooms', { body }));
			draft = { title: '', slug: '', description: '' };
			slugTouched = false;
			creating = false;
			await invalidateAll();
			void chat.loadChats();
			chat.open({ room: `room:${room.slug}`, title: room.title, href: '/chat', image: null });
		} catch (e) {
			createError = createMessage(e);
		} finally {
			saving = false;
		}
	}

	/** Два разных 409: занятый адрес чинится правкой поля, лимит комнат — только удалением. */
	function createMessage(e: unknown): string {
		if (!(e instanceof ApiError)) return errorMessage(e);
		if (e.code === 'slug_taken') return 'Этот адрес занят или зарезервирован — придумайте другой.';
		if (e.code === 'room_limit')
			return 'У вас уже 5 своих комнат. Удалите одну, чтобы завести новую.';
		return errorMessage(e);
	}

	// Своя комната: правит и удаляет владелец, а также админ. Системную не трогает никто.
	let editing = $state<string | null>(null);
	let editDraft = $state({ title: '', description: '' });
	let confirmDelete = $state<string | null>(null);
	let reporting = $state<string | null>(null);
	let reason = $state('');
	const reported = $state<Record<string, boolean>>({});

	const canManage = (room: SchemaCustomRoom) =>
		!room.system &&
		session.status === 'authed' &&
		(room.owner?.id === session.user?.id || session.user?.role === 'admin');

	async function run(slug: string, action: () => Promise<unknown>) {
		busy = slug;
		error = '';
		try {
			await action();
			return true;
		} catch (e) {
			error =
				e instanceof ApiError && e.code === 'room_is_system'
					? 'Это общая комната — её нельзя менять.'
					: errorMessage(e);
			return false;
		} finally {
			busy = '';
		}
	}

	async function save(event: SubmitEvent, slug: string) {
		event.preventDefault();
		const title = editDraft.title.trim();
		if (!title || title.length > 100) {
			error = 'Название — от 1 до 100 символов.';
			return;
		}
		const ok = await run(slug, () =>
			unwrap(
				api.social.PATCH('/api/v1/social/chat/rooms/{slug}', {
					params: { path: { slug } },
					body: { title, description: editDraft.description.trim() || null }
				})
			)
		);
		if (ok) {
			editing = null;
			await invalidateAll();
			void chat.loadChats();
		}
	}

	async function remove(slug: string) {
		const ok = await run(slug, () =>
			unwrap(api.social.DELETE('/api/v1/social/chat/rooms/{slug}', { params: { path: { slug } } }))
		);
		if (ok) {
			confirmDelete = null;
			await invalidateAll();
			void chat.loadChats();
		}
	}

	async function report(event: SubmitEvent, slug: string) {
		event.preventDefault();
		const ok = await run(slug, () =>
			unwrap(
				api.social.POST('/api/v1/social/chat/rooms/{slug}/report', {
					params: { path: { slug } },
					body: { reason: reason.trim() }
				})
			)
		);
		if (ok) {
			reported[slug] = true;
			reporting = null;
			reason = '';
		}
	}

	/** Вступил ли: joined из каталога, после «Вступить / Выйти» — локально. */
	const toggled = $state<Record<string, boolean>>({});
	const member = (slug: string) =>
		toggled[slug] ?? rooms.find((r) => r.slug === slug)?.joined ?? false;

	async function toggle(slug: string) {
		const params = { path: { slug } };
		busy = slug;
		error = '';
		try {
			await unwrap(
				member(slug)
					? api.social.DELETE('/api/v1/social/chat/rooms/{slug}/membership', { params })
					: api.social.PUT('/api/v1/social/chat/rooms/{slug}/membership', { params })
			);
			toggled[slug] = !member(slug);
			void chat.loadChats();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = '';
		}
	}
</script>

<Seo
	title="Комнаты чата"
	description="Общие комнаты чата Nexus: обсуждайте фильмы, книги и игры."
/>

<div class="mb-2 flex flex-wrap items-center gap-3">
	<h1 class="text-3xl font-black sm:text-4xl">Комнаты</h1>
	{#if session.status === 'authed'}
		<button
			class="btn ml-auto rounded-full btn-primary btn-sm"
			aria-expanded={creating}
			onclick={() => (creating = !creating)}>{creating ? 'Отмена' : 'Создать комнату'}</button
		>
	{:else if session.status === 'guest'}
		<a href={loginUrl(page.url)} class="btn ml-auto rounded-full btn-sm">Войти, чтобы создать</a>
	{/if}
</div>
<p class="mb-6 text-base-content/60">
	Общие чаты Nexus. Комнату может завести любой — она сразу появится здесь. Чаты фильмов, людей и
	тем открываются кнопкой «Открыть чат» на их страницах.
</p>

{#if creating}
	<form
		class="mb-8 flex flex-col gap-3 rounded-box bg-base-200 p-4 ring-1 ring-base-300"
		onsubmit={create}
		aria-label="Новая комната"
	>
		<div class="flex flex-wrap gap-3">
			<label class="floating-label flex-1">
				<span>Название</span>
				<input
					class="input w-full"
					placeholder="Классическая литература"
					maxlength="100"
					bind:value={draft.title}
					oninput={() => !slugTouched && (draft.slug = slugify(draft.title).slice(0, 80))}
				/>
			</label>
			<label class="floating-label flex-1">
				<span>Адрес (slug)</span>
				<input
					class="input w-full"
					placeholder="classic-literature"
					maxlength="80"
					bind:value={draft.slug}
					oninput={() => (slugTouched = true)}
				/>
			</label>
		</div>
		<label class="floating-label">
			<span>Описание — о чём комната</span>
			<input
				class="input w-full"
				placeholder="О чём комната"
				maxlength="500"
				bind:value={draft.description}
			/>
		</label>
		<p class="text-xs text-base-content/50">
			Адрес потом не изменить — это постоянная ссылка комнаты. Вы станете её участником сразу.
		</p>
		{#if createError}<p role="alert" class="text-sm text-error">{createError}</p>{/if}
		<div class="flex gap-2">
			<button class="btn btn-primary btn-sm" disabled={saving}>Создать</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (creating = false)}
				>Отмена</button
			>
		</div>
	</form>
{/if}

<div class="mb-6 flex flex-wrap items-center gap-3">
	<label class="input min-w-56 flex-1 input-sm">
		<input
			type="search"
			placeholder="Найти комнату"
			aria-label="Найти комнату"
			bind:value={search}
			oninput={onSearch}
		/>
		<svg
			class="size-4 opacity-50"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
		>
	</label>
	{#if !data.q}
		<!-- При поиске порядок задаёт близость к запросу — переключатель не действует. -->
		<div class="flex gap-2" role="group" aria-label="Порядок комнат">
			{#each ROOM_SORTS as s (s.value)}
				<a
					href="/chat?sort={s.value}"
					data-sveltekit-noscroll
					aria-current={data.sort === s.value ? 'page' : undefined}
					class={['btn rounded-full btn-sm', data.sort === s.value ? 'btn-primary' : 'btn-ghost']}
					>{s.title}</a
				>
			{/each}
		</div>
	{/if}
</div>

{#if error}<p role="alert" class="mb-4 text-error">{error}</p>{/if}

{#if data.rooms.error}
	<LoadError message={data.rooms.error} />
{:else if !rooms.length}
	<EmptyState title={data.q ? 'Ничего не нашлось' : 'Комнат пока нет'} />
{:else}
	<ul class="grid gap-3 sm:grid-cols-2">
		{#each rooms as room (room.id)}
			{@const meta = { room: `room:${room.slug}`, title: room.title, href: '/chat', image: null }}
			<li class="flex items-start gap-4 rounded-box bg-base-200 p-4 ring-1 ring-base-300">
				<RoomIcon {meta} size="size-12" />
				<div class="min-w-0 flex-1">
					<h2 class="flex items-center gap-2 font-bold">
						<span class="truncate">{room.title}</span>
						{#if room.system}
							<span class="badge shrink-0 badge-ghost badge-sm">общая</span>
						{/if}
					</h2>
					{#if room.description}
						<p class="mt-1 line-clamp-2 text-sm text-base-content/70">{room.description}</p>
					{/if}
					{#if room.owner}
						<p class="mt-1 text-xs text-base-content/50">
							Создал <a href="/u/{room.owner.username}" class="link link-hover"
								>{room.owner.display_name || room.owner.username}</a
							>
						</p>
					{/if}
					<p class="mt-1 text-xs text-base-content/50">
						{count(room.members_count, ['участник', 'участника', 'участников'])} ·
						{count(room.messages_count, ['сообщение', 'сообщения', 'сообщений'])}
						{#if activityLabel(room)}
							· <span class="font-bold text-success">{activityLabel(room)}</span>
						{/if}
					</p>
					{#if editing === room.slug}
						<!-- Правка своей комнаты: адрес не меняется, он постоянный. -->
						<form class="mt-3 flex flex-col gap-2" onsubmit={(e) => save(e, room.slug)}>
							<label class="sr-only" for="title-{room.id}">Название</label>
							<input
								id="title-{room.id}"
								class="input input-sm"
								maxlength="100"
								bind:value={editDraft.title}
							/>
							<label class="sr-only" for="desc-{room.id}">Описание</label>
							<input
								id="desc-{room.id}"
								class="input input-sm"
								placeholder="Описание"
								maxlength="500"
								bind:value={editDraft.description}
							/>
							<div class="flex gap-2">
								<button class="btn btn-primary btn-xs" disabled={busy === room.slug}
									>Сохранить</button
								>
								<button type="button" class="btn btn-ghost btn-xs" onclick={() => (editing = null)}
									>Отмена</button
								>
							</div>
						</form>
					{:else}
						<div class="mt-3 flex flex-wrap gap-2">
							<button class="{HERO_GLASS} btn-sm" onclick={() => chat.open(meta)}>Открыть</button>
							{#if room.system}
								<!-- В общей комнате состоят все: вступать и выходить некуда. -->
							{:else if session.status === 'authed'}
								<button
									class={[
										'btn rounded-full btn-sm',
										member(room.slug) ? 'btn-ghost' : 'btn-primary'
									]}
									disabled={busy === room.slug || (!mine && !(room.slug in toggled))}
									onclick={() => toggle(room.slug)}
									>{member(room.slug) ? 'Выйти' : 'Вступить'}</button
								>
							{:else if session.status === 'guest'}
								<a href={loginUrl(page.url)} class="btn rounded-full btn-primary btn-sm">Вступить</a
								>
							{/if}

							{#if canManage(room)}
								<button
									class="btn rounded-full btn-ghost btn-sm"
									onclick={() => {
										editDraft = { title: room.title, description: room.description ?? '' };
										editing = room.slug;
									}}>Изменить</button
								>
								{#if confirmDelete === room.slug}
									<button
										class="btn rounded-full btn-error btn-sm"
										disabled={busy === room.slug}
										onclick={() => remove(room.slug)}>Удалить навсегда</button
									>
									<button
										class="btn rounded-full btn-ghost btn-sm"
										onclick={() => (confirmDelete = null)}>Отмена</button
									>
								{:else}
									<button
										class="btn rounded-full btn-ghost text-error btn-sm"
										onclick={() => (confirmDelete = room.slug)}>Удалить</button
									>
								{/if}
							{:else if session.status === 'authed' && !room.system}
								<button
									class="btn rounded-full btn-ghost btn-sm"
									disabled={reported[room.slug]}
									onclick={() => (reporting = reporting === room.slug ? null : room.slug)}
									>{reported[room.slug] ? 'Жалоба отправлена' : 'Пожаловаться'}</button
								>
							{/if}
						</div>

						{#if reporting === room.slug && !reported[room.slug]}
							<form class="mt-2 flex flex-wrap gap-2" onsubmit={(e) => report(e, room.slug)}>
								<label class="sr-only" for="reason-{room.id}">Что не так с комнатой</label>
								<input
									id="reason-{room.id}"
									class="input min-w-48 flex-1 input-sm"
									placeholder="Что не так с комнатой"
									maxlength="500"
									bind:value={reason}
								/>
								<button class="btn btn-primary btn-sm" disabled={busy === room.slug}
									>Отправить</button
								>
								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={() => (reporting = null)}>Отмена</button
								>
							</form>
						{/if}
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}
