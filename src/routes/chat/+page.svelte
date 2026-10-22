<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
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
		const sort = data.sort;
		unwrap(
			api.social.GET('/api/v1/social/chat/rooms', {
				params: { query: { limit: 100, sort } as { limit: number } }
			})
		)
			.then((page) => (mine = page.items))
			.catch(() => {});
	});
	const rooms = $derived(mine ?? data.rooms.data?.items ?? []);
	/** Бэкенд ещё не отдаёт активность — порядок один, переключатель не нужен. */
	const hasActivity = $derived(
		rooms.some((r) => (r as { messages_24h?: number }).messages_24h !== undefined)
	);

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
			const room = await unwrap(
				api.social.POST('/api/v1/social/chat/rooms' as '/api/v1/social/admin/chat/rooms', { body })
			);
			draft = { title: '', slug: '', description: '' };
			slugTouched = false;
			creating = false;
			await invalidateAll();
			void chat.loadChats();
			chat.open({ room: `room:${room.slug}`, title: room.title, href: '/chat', image: null });
		} catch (e) {
			createError =
				e instanceof ApiError && e.status === 409 ? 'Такой slug уже занят.' : errorMessage(e);
		} finally {
			saving = false;
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

{#if hasActivity}
	<div class="mb-6 flex gap-2" role="group" aria-label="Порядок комнат">
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

{#if error}<p role="alert" class="mb-4 text-error">{error}</p>{/if}

{#if data.rooms.error}
	<LoadError message={data.rooms.error} />
{:else if !rooms.length}
	<EmptyState title="Комнат пока нет" />
{:else}
	<ul class="grid gap-3 sm:grid-cols-2">
		{#each rooms as room (room.id)}
			{@const meta = { room: `room:${room.slug}`, title: room.title, href: '/chat', image: null }}
			<li class="flex items-start gap-4 rounded-box bg-base-200 p-4 ring-1 ring-base-300">
				<RoomIcon {meta} size="size-12" />
				<div class="min-w-0 flex-1">
					<h2 class="truncate font-bold">{room.title}</h2>
					{#if room.description}
						<p class="mt-1 line-clamp-2 text-sm text-base-content/70">{room.description}</p>
					{/if}
					<p class="mt-1 text-xs text-base-content/50">
						{count(room.members_count, ['участник', 'участника', 'участников'])} ·
						{count(room.messages_count, ['сообщение', 'сообщения', 'сообщений'])}
						{#if activityLabel(room)}
							· <span class="font-bold text-success">{activityLabel(room)}</span>
						{/if}
					</p>
					<div class="mt-3 flex flex-wrap gap-2">
						<button class="{HERO_GLASS} btn-sm" onclick={() => chat.open(meta)}>Открыть</button>
						{#if session.status === 'authed'}
							<button
								class={['btn rounded-full btn-sm', member(room.slug) ? 'btn-ghost' : 'btn-primary']}
								disabled={busy === room.slug || (!mine && !(room.slug in toggled))}
								onclick={() => toggle(room.slug)}>{member(room.slug) ? 'Выйти' : 'Вступить'}</button
							>
						{:else if session.status === 'guest'}
							<a href={loginUrl(page.url)} class="btn rounded-full btn-primary btn-sm">Вступить</a>
						{/if}
					</div>
				</div>
			</li>
		{/each}
	</ul>
{/if}
