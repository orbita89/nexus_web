<script lang="ts">
	import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaCustomRoom, SchemaReportedRoom } from '#lib/api/generated/social.ts';
	import { shortTime } from '#lib/chat/rooms.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { slugError, slugify } from '#lib/admin/slug.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Комнаты чата: создать, изменить название и описание (slug — адрес канала room:<slug>, не
	// меняется), удалить вместе с сообщениями и участниками.
	let rooms = $state<SchemaCustomRoom[]>([]);
	let error = $state('');
	let editing = $state<string | null>(null);
	let draft = $state({ title: '', description: '' });
	let created = $state({ title: '', slug: '', description: '' });
	let slugTouched = $state(false);
	let confirmDelete = $state<string | null>(null);

	// Комнаты с жалобами — сверху: больше жалоб выше.
	let reports = $state<SchemaReportedRoom[]>([]);

	async function load() {
		try {
			rooms = (
				await unwrap(
					api.social.GET('/api/v1/social/chat/rooms', { params: { query: { limit: 100 } } })
				)
			).items;
			reports = (
				await unwrap(
					api.social.GET('/api/v1/social/admin/chat/rooms/reports', {
						params: { query: { limit: 50 } }
					})
				)
			).items;
		} catch (e) {
			error = errorMessage(e);
		}
	}
	void load();

	async function run(action: () => Promise<unknown>) {
		error = '';
		try {
			await action();
			await load();
			return true;
		} catch (e) {
			error = e instanceof ApiError && e.status === 409 ? 'Такой slug уже занят.' : errorMessage(e);
			return false;
		}
	}

	/** Правила бэкенда: название 1–100, описание до 500, slug a-z, 0-9 и дефисы, 1–80. */
	function invalid(body: { title: string; description: string; slug?: string }) {
		if (!body.title) return 'Введите название.';
		if (body.title.length > 100) return 'Название — не длиннее 100 символов.';
		if (body.description.length > 500) return 'Описание — не длиннее 500 символов.';
		if (body.slug !== undefined) {
			if (body.slug.length > 80) return 'slug — не длиннее 80 символов.';
			return slugError(body.slug);
		}
		return '';
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		const body = {
			title: created.title.trim(),
			slug: created.slug.trim(),
			description: created.description.trim()
		};
		error = invalid(body) || '';
		if (error) return;
		const request = { ...body, description: body.description || null };
		if (
			await run(() => unwrap(api.social.POST('/api/v1/social/admin/chat/rooms', { body: request })))
		) {
			created = { title: '', slug: '', description: '' };
			slugTouched = false;
		}
	}

	async function save(event: SubmitEvent, slug: string) {
		event.preventDefault();
		const body = { title: draft.title.trim(), description: draft.description.trim() };
		error = invalid(body) || '';
		if (error) return;
		const ok = await run(() =>
			unwrap(
				api.social.PATCH('/api/v1/social/admin/chat/rooms/{slug}', {
					params: { path: { slug } },
					body: { title: body.title, description: body.description || null }
				})
			)
		);
		if (ok) editing = null;
	}

	const remove = (slug: string) =>
		run(() =>
			unwrap(
				api.social.DELETE('/api/v1/social/admin/chat/rooms/{slug}', { params: { path: { slug } } })
			)
		);
</script>

<svelte:head><title>Комнаты чата — Админка — Nexus</title></svelte:head>

<h1 class="mb-6 text-3xl font-black">Комнаты чата</h1>

<form
	class="mb-6 flex flex-wrap items-end gap-2 rounded-box bg-base-200 p-3 ring-1 ring-base-300"
	onsubmit={create}
	aria-label="Новая комната"
>
	<label class="floating-label">
		<span>Название</span>
		<input
			class="input input-sm"
			placeholder="Название"
			maxlength="100"
			bind:value={created.title}
			oninput={() => !slugTouched && (created.slug = slugify(created.title).slice(0, 80))}
		/>
	</label>
	<label class="floating-label">
		<span>slug</span>
		<input
			class="input input-sm"
			placeholder="slug"
			maxlength="80"
			bind:value={created.slug}
			oninput={() => (slugTouched = true)}
		/>
	</label>
	<label class="floating-label min-w-64 flex-1">
		<span>Описание</span>
		<input
			class="input w-full input-sm"
			placeholder="Описание"
			maxlength="500"
			bind:value={created.description}
		/>
	</label>
	<button class="btn btn-primary btn-sm">Создать комнату</button>
</form>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

{#if reports.length}
	<h2 class="mb-2 text-xl font-black">Жалобы</h2>
	<ul class="mb-6 flex flex-col gap-2">
		{#each reports as item (item.room.id)}
			<li
				class="flex flex-wrap items-center gap-3 rounded-box bg-warning/10 p-3 ring-1 ring-warning/30"
			>
				<span class="min-w-0 flex-1">
					<span class="block truncate font-medium">{item.room.title}</span>
					<span class="block font-mono text-xs text-base-content/60">{item.room.slug}</span>
				</span>
				<span class="text-sm">
					{item.reports_count} · последняя {shortTime(item.last_report_at)}
				</span>
				<button
					class="btn btn-ghost btn-xs"
					onclick={() => {
						draft = { title: item.room.title, description: item.room.description ?? '' };
						editing = item.room.slug;
					}}>Изменить</button
				>
				<button class="btn btn-error btn-xs" onclick={() => remove(item.room.slug)}>Удалить</button>
			</li>
		{/each}
	</ul>
{/if}

<div class="overflow-x-auto rounded-box ring-1 ring-base-300">
	<table class="table">
		<thead
			><tr><th>Название</th><th>slug</th><th>Участников</th><th>Сообщений</th><th></th></tr></thead
		>
		<tbody>
			{#each rooms as room (room.id)}
				<tr>
					{#if editing === room.slug}
						<td colspan="5">
							<form class="flex flex-wrap items-center gap-2" onsubmit={(e) => save(e, room.slug)}>
								<label class="sr-only" for="room-title-{room.id}">Название</label>
								<input
									id="room-title-{room.id}"
									class="input input-sm"
									maxlength="100"
									bind:value={draft.title}
								/>
								<label class="sr-only" for="room-desc-{room.id}">Описание</label>
								<input
									id="room-desc-{room.id}"
									class="input min-w-64 flex-1 input-sm"
									placeholder="Описание"
									maxlength="500"
									bind:value={draft.description}
								/>
								<button class="btn btn-primary btn-xs">Сохранить</button>
								<button type="button" class="btn btn-ghost btn-xs" onclick={() => (editing = null)}
									>Отмена</button
								>
							</form>
						</td>
					{:else}
						<td>
							<p class="font-medium">{room.title}</p>
							{#if room.description}<p class="text-xs text-base-content/60">
									{room.description}
								</p>{/if}
						</td>
						<td class="font-mono text-sm text-base-content/60">{room.slug}</td>
						<td class="tabular-nums">{room.members_count}</td>
						<td class="tabular-nums">{room.messages_count}</td>
						<td class="text-right whitespace-nowrap">
							{#if room.system}
								<span class="badge badge-ghost badge-sm">общая — не меняется</span>
							{:else if confirmDelete === room.slug}
								<span class="text-sm">Удалить вместе с сообщениями?</span>
								<button class="btn btn-error btn-xs" onclick={() => remove(room.slug)}
									>Удалить</button
								>
								<button class="btn btn-ghost btn-xs" onclick={() => (confirmDelete = null)}
									>Отмена</button
								>
							{:else}
								<button
									class="btn btn-ghost btn-xs"
									aria-label="Изменить комнату {room.title}"
									onclick={() => {
										draft = { title: room.title, description: room.description ?? '' };
										editing = room.slug;
									}}>Изменить</button
								>
								<button
									class="btn btn-ghost text-error btn-xs"
									aria-label="Удалить комнату {room.title}"
									onclick={() => (confirmDelete = room.slug)}>Удалить</button
								>
							{/if}
						</td>
					{/if}
				</tr>
			{:else}
				<tr><td colspan="5" class="text-center text-base-content/50">Комнат пока нет</td></tr>
			{/each}
		</tbody>
	</table>
</div>
