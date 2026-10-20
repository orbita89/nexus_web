<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { count } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import RoomIcon from '#lib/components/chat/RoomIcon.svelte';
	import { HERO_GLASS } from '#lib/components/card/buttons.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import type { PageProps } from './$types';

	// Каталог комнат: «Вступить» — комната в «Моих чатах» и канал подписан; «Выйти» — наоборот.
	// Участник ли — по списку «Мои чаты» (GET /chats).
	let { data }: PageProps = $props();

	let busy = $state('');
	let error = $state('');

	const member = (slug: string) => !!chat.summary(`room:${slug}`);

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
			await chat.loadChats();
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

<h1 class="mb-2 text-3xl font-black sm:text-4xl">Комнаты</h1>
<p class="mb-8 text-base-content/60">
	Общие чаты Nexus. Чаты фильмов, людей и тем открываются кнопкой «Открыть чат» на их страницах.
</p>

{#if error}<p role="alert" class="mb-4 text-error">{error}</p>{/if}

{#if data.rooms.error}
	<LoadError message={data.rooms.error} />
{:else if !data.rooms.data?.items.length}
	<EmptyState title="Комнат пока нет" />
{:else}
	<ul class="grid gap-3 sm:grid-cols-2">
		{#each data.rooms.data.items as room (room.id)}
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
					</p>
					<div class="mt-3 flex flex-wrap gap-2">
						<button class="{HERO_GLASS} btn-sm" onclick={() => chat.open(meta)}>Открыть</button>
						{#if session.status === 'authed'}
							<button
								class={['btn rounded-full btn-sm', member(room.slug) ? 'btn-ghost' : 'btn-primary']}
								disabled={busy === room.slug || !chat.chats}
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
