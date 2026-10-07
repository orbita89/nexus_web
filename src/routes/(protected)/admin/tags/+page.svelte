<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaTagWithCount } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { slugError, slugify } from '#lib/admin/slug.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Теги: создать, переименовать или сменить slug на месте, удалить (снимается со всех сущностей).
	let tags = $state<SchemaTagWithCount[]>([]);
	let error = $state('');
	let editing = $state<string | null>(null);
	let draft = $state({ name: '', slug: '' });
	let created = $state({ name: '', slug: '' });
	let slugTouched = $state(false);
	let confirmDelete = $state<string | null>(null);

	async function load() {
		try {
			tags = (await unwrap(api.catalog.GET('/api/v1/catalog/tags'))).toSorted((a, b) =>
				a.name.localeCompare(b.name, 'ru')
			);
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
			error = errorMessage(e);
			return false;
		}
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		const body = { name: created.name.trim(), slug: created.slug.trim() };
		error = (!body.name && 'Введите название.') || slugError(body.slug) || '';
		if (error) return;
		if (await run(() => unwrap(api.catalog.POST('/api/v1/catalog/admin/tags', { body })))) {
			created = { name: '', slug: '' };
			slugTouched = false;
		}
	}

	async function save(event: SubmitEvent, id: string) {
		event.preventDefault();
		const body = { name: draft.name.trim(), slug: draft.slug.trim() };
		error = (!body.name && 'Введите название.') || slugError(body.slug) || '';
		if (error) return;
		if (
			await run(() =>
				unwrap(
					api.catalog.PATCH('/api/v1/catalog/admin/tags/{id}', { params: { path: { id } }, body })
				)
			)
		) {
			editing = null;
		}
	}

	const remove = (id: string) =>
		run(() =>
			unwrap(api.catalog.DELETE('/api/v1/catalog/admin/tags/{id}', { params: { path: { id } } }))
		);
</script>

<svelte:head><title>Теги — Админка — Nexus</title></svelte:head>

<h1 class="mb-6 text-3xl font-black">Теги</h1>

<form
	class="mb-6 flex flex-wrap items-end gap-2 rounded-box bg-base-200 p-3 ring-1 ring-base-300"
	onsubmit={create}
	aria-label="Новый тег"
>
	<label class="floating-label">
		<span>Название</span>
		<input
			class="input input-sm"
			placeholder="Название"
			bind:value={created.name}
			oninput={() => !slugTouched && (created.slug = slugify(created.name))}
		/>
	</label>
	<label class="floating-label">
		<span>slug</span>
		<input
			class="input input-sm"
			placeholder="slug"
			bind:value={created.slug}
			oninput={() => (slugTouched = true)}
		/>
	</label>
	<button class="btn btn-primary btn-sm">Добавить тег</button>
</form>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

<div class="overflow-x-auto rounded-box ring-1 ring-base-300">
	<table class="table">
		<thead><tr><th>Название</th><th>slug</th><th>Произведений</th><th></th></tr></thead>
		<tbody>
			{#each tags as tag (tag.id)}
				<tr>
					{#if editing === tag.id}
						<td colspan="4">
							<form class="flex flex-wrap items-center gap-2" onsubmit={(e) => save(e, tag.id)}>
								<label class="sr-only" for="tag-name-{tag.id}">Название</label>
								<input id="tag-name-{tag.id}" class="input input-sm" bind:value={draft.name} />
								<label class="sr-only" for="tag-slug-{tag.id}">slug</label>
								<input id="tag-slug-{tag.id}" class="input input-sm" bind:value={draft.slug} />
								<button class="btn btn-primary btn-xs">Сохранить</button>
								<button type="button" class="btn btn-ghost btn-xs" onclick={() => (editing = null)}
									>Отмена</button
								>
							</form>
						</td>
					{:else}
						<td class="font-medium"
							><a href="/tags/{tag.slug}" class="hover:text-primary">{tag.name}</a></td
						>
						<td class="font-mono text-sm text-base-content/60">{tag.slug}</td>
						<td class="tabular-nums">{tag.entities_count}</td>
						<td class="text-right whitespace-nowrap">
							{#if confirmDelete === tag.id}
								<span class="text-sm"
									>Удалить{tag.entities_count ? ` и снять с ${tag.entities_count}` : ''}?</span
								>
								<button class="btn btn-error btn-xs" onclick={() => remove(tag.id)}>Удалить</button>
								<button class="btn btn-ghost btn-xs" onclick={() => (confirmDelete = null)}
									>Отмена</button
								>
							{:else}
								<button
									class="btn btn-ghost btn-xs"
									aria-label="Изменить тег {tag.name}"
									onclick={() => {
										draft = { name: tag.name, slug: tag.slug };
										editing = tag.id;
									}}>Изменить</button
								>
								<button
									class="btn btn-ghost text-error btn-xs"
									aria-label="Удалить тег {tag.name}"
									onclick={() => (confirmDelete = tag.id)}>Удалить</button
								>
							{/if}
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
