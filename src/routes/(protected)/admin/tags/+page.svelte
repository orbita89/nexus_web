<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaTagKind } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { slugError, slugify } from '#lib/admin/slug.ts';
	import { listTags, tagBody, type TagEntry } from '#lib/catalog/tags.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Теги: создать, переименовать, сменить slug или вид (жанр — в шапке карточки, тег — над
	// «О фильме») на месте, удалить (снимается со всех сущностей).
	const KINDS: { value: SchemaTagKind; title: string }[] = [
		{ value: 'genre', title: 'Жанр' },
		{ value: 'tag', title: 'Тег' }
	];
	type Draft = { name: string; slug: string; kind: SchemaTagKind; description: string };
	// Описание живёт в плитке жанра и в шапке страницы тега: там видно две строки, остальное
	// обрезается. Поэтому мягкий предел — пара предложений, за ним счётчик краснеет.
	const ABOUT_MAX = 200;
	const kindTitle = (kind: SchemaTagKind) => KINDS.find((k) => k.value === kind)?.title ?? kind;
	let tags = $state<TagEntry[]>([]);
	let error = $state('');
	let editing = $state<string | null>(null);
	let draft = $state<Draft>({ name: '', slug: '', kind: 'tag', description: '' });
	let created = $state<Draft>({ name: '', slug: '', kind: 'tag', description: '' });
	let slugTouched = $state(false);
	let confirmDelete = $state<string | null>(null);

	async function load() {
		try {
			tags = (await listTags(api)).toSorted((a, b) => a.name.localeCompare(b.name, 'ru'));
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
		const body = tagBody(
			{ name: created.name.trim(), slug: created.slug.trim(), kind: created.kind },
			created.description
		);
		error = (!body.name && 'Введите название.') || slugError(body.slug) || '';
		if (error) return;
		if (await run(() => unwrap(api.catalog.POST('/api/v1/catalog/admin/tags', { body })))) {
			created = { name: '', slug: '', kind: created.kind, description: '' };
			slugTouched = false;
		}
	}

	async function save(event: SubmitEvent, id: string) {
		event.preventDefault();
		const name = draft.name.trim();
		const slug = draft.slug.trim();
		error = (!name && 'Введите название.') || slugError(slug) || '';
		if (error) return;
		// Шлём только изменённое: переименование и смена slug на большом теге перетряхивают все
		// его сущности (у «Боевика» их 13 тысяч — PATCH не укладывается в таймаут nginx), а
		// правка одного описания столько не стоит. Пропущенное поле бэкенд оставляет как было.
		const was = tags.find((t) => t.id === id);
		const body = tagBody(
			{
				...(name !== was?.name && { name }),
				...(slug !== was?.slug && { slug }),
				...(draft.kind !== was?.kind && { kind: draft.kind })
			},
			draft.description,
			was?.description ?? ''
		);
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

<svelte:head><title>Теги — Админка — Кассандра</title></svelte:head>

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
	<label class="sr-only" for="tag-kind-new">Жанр / тег</label>
	<select id="tag-kind-new" class="select w-28 select-sm" bind:value={created.kind}>
		{#each KINDS as k (k.value)}<option value={k.value}>{k.title}</option>{/each}
	</select>
	<label class="floating-label grow basis-64">
		<span>Описание</span>
		<textarea
			class="textarea w-full textarea-sm"
			rows="1"
			placeholder="Описание: одно-два предложения"
			bind:value={created.description}></textarea>
	</label>
	<button class="btn btn-primary btn-sm">Добавить тег</button>
</form>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

<div class="overflow-x-auto rounded-box ring-1 ring-base-300">
	<table class="table">
		<thead><tr><th>Название</th><th>slug</th><th>Вид</th><th>Произведений</th><th></th></tr></thead>
		<tbody>
			{#each tags as tag (tag.id)}
				<tr>
					{#if editing === tag.id}
						<td colspan="5">
							<form class="flex flex-wrap items-center gap-2" onsubmit={(e) => save(e, tag.id)}>
								<label class="sr-only" for="tag-name-{tag.id}">Название</label>
								<input id="tag-name-{tag.id}" class="input input-sm" bind:value={draft.name} />
								<label class="sr-only" for="tag-slug-{tag.id}">slug</label>
								<input id="tag-slug-{tag.id}" class="input input-sm" bind:value={draft.slug} />
								<label class="sr-only" for="tag-kind-{tag.id}">Жанр / тег</label>
								<select
									id="tag-kind-{tag.id}"
									class="select w-28 select-sm"
									bind:value={draft.kind}
								>
									{#each KINDS as k (k.value)}<option value={k.value}>{k.title}</option>{/each}
								</select>
								<label class="sr-only" for="tag-about-{tag.id}">Описание</label>
								<textarea
									id="tag-about-{tag.id}"
									class="textarea grow basis-64 textarea-sm"
									rows="1"
									placeholder="Описание: одно-два предложения"
									bind:value={draft.description}></textarea>
								<button class="btn btn-primary btn-xs">Сохранить</button>
								<button type="button" class="btn btn-ghost btn-xs" onclick={() => (editing = null)}
									>Отмена</button
								>
							</form>
						</td>
					{:else}
						<td class="font-medium">
							<a href="/tags/{tag.slug}" class="hover:text-primary">{tag.name}</a>
							{#if tag.description}
								<p class="max-w-md text-xs font-normal text-base-content/50">{tag.description}</p>
							{/if}
						</td>
						<td class="font-mono text-sm text-base-content/60">{tag.slug}</td>
						<td class="text-sm">{kindTitle(tag.kind)}</td>
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
										draft = {
											name: tag.name,
											slug: tag.slug,
											kind: tag.kind,
											description: tag.description ?? ''
										};
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
