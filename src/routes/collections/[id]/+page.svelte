<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { asKind } from '#lib/catalog/kinds.ts';
	import { count, summary } from '#lib/catalog/labels.ts';
	import { displayName, reviewDate } from '#lib/social/reviews.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import CollectionEditor from '#lib/components/social/CollectionEditor.svelte';
	import CollectionForm from '#lib/components/social/CollectionForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// С сервера пришло «не найдено» — возможно, это своя приватная: перечитываем с токеном.
	onMount(() => {
		if (!data.collection) void invalidateAll();
	});

	const collection = $derived(data.collection);
	const own = $derived(
		!!collection && session.status === 'authed' && session.user?.id === collection.owner.id
	);
	// EntityRef → карточка постера; заметка владельца — подписью.
	const entities = $derived(
		(collection?.items ?? []).flatMap((item): SchemaEntitySummary[] => {
			const kind = asKind(item.entity.kind);
			return kind ? [{ ...item.entity, kind }] : [];
		})
	);
	const notes = $derived(new Map(collection?.items.map((i) => [i.entity.slug, i.note]) ?? []));

	let mode = $state<'view' | 'edit' | 'items' | 'delete'>('view');
	let error = $state('');

	async function update(form: { title: string; description: string | null; is_public: boolean }) {
		try {
			await unwrap(
				api.social.PATCH('/api/v1/social/collections/{id}', {
					params: { path: { id: collection!.id } },
					body: form
				})
			);
			mode = 'view';
			await invalidateAll();
			return null;
		} catch (e) {
			return errorMessage(e);
		}
	}

	async function remove() {
		error = '';
		try {
			await unwrap(
				api.social.DELETE('/api/v1/social/collections/{id}', {
					params: { path: { id: collection!.id } }
				})
			);
			await goto(`/u/${collection!.owner.username}/collections`);
		} catch (e) {
			error = errorMessage(e);
		}
	}
</script>

<svelte:head>
	{#if !collection}<meta name="robots" content="noindex" />{/if}
</svelte:head>

{#if !collection}
	<div class="h-40 skeleton" aria-label="Загрузка коллекции"></div>
{:else}
	<Seo
		title={collection.title}
		description={summary(collection.description) ||
			`Коллекция @${collection.owner.username} в Nexus: ${count(collection.items_count, ['произведение', 'произведения', 'произведений'])}.`}
	/>

	<header class="mb-8">
		<a href="/collections" class="link text-sm text-primary link-hover">← Коллекции</a>
		{#if mode === 'edit'}
			<div class="mt-3 max-w-lg rounded-box bg-base-200 p-4 ring-1 ring-base-300">
				<CollectionForm
					title={collection.title}
					description={collection.description ?? ''}
					isPublic={collection.is_public}
					submitLabel="Сохранить"
					onsubmit={update}
					oncancel={() => (mode = 'view')}
				/>
			</div>
		{:else}
			<h1 class="mt-2 text-3xl font-black sm:text-4xl">
				{collection.title}
				{#if !collection.is_public}<span class="ml-2 badge badge-ghost align-middle">🔒 личная</span
					>{/if}
			</h1>
			{#if collection.description}
				<p class="mt-2 max-w-2xl whitespace-pre-line text-base-content/70">
					{collection.description}
				</p>
			{/if}
		{/if}
		<div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-base-content/60">
			<a href="/u/{collection.owner.username}" class="flex items-center gap-2 hover:text-primary">
				<Avatar user={collection.owner} size="w-7" />
				<span class="font-semibold text-base-content">{displayName(collection.owner)}</span>
			</a>
			<span>·</span>
			<span>{count(collection.items_count, ['произведение', 'произведения', 'произведений'])}</span>
			<span>·</span>
			<span>обновлена {reviewDate(collection.updated_at)}</span>
		</div>

		{#if own && mode !== 'edit'}
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<button
					class={['btn btn-sm', mode === 'items' ? 'btn-primary' : '']}
					onclick={() => (mode = mode === 'items' ? 'view' : 'items')}
					>{mode === 'items' ? 'Готово' : 'Изменить содержимое'}</button
				>
				<button class="btn btn-ghost btn-sm" onclick={() => (mode = 'edit')}
					>Название и описание</button
				>
				{#if mode === 'delete'}
					<span class="flex items-center gap-2 text-sm">
						Удалить коллекцию?
						<button class="btn btn-error btn-sm" onclick={remove}>Удалить</button>
						<button class="btn btn-ghost btn-sm" onclick={() => (mode = 'view')}>Отмена</button>
					</span>
				{:else}
					<button class="btn btn-ghost btn-sm" onclick={() => (mode = 'delete')}
						>Удалить коллекцию</button
					>
				{/if}
			</div>
			{#if error}<div class="mt-2"><Alert>{error}</Alert></div>{/if}
		{/if}
	</header>

	{#if own && mode === 'items'}
		<div class="max-w-3xl">
			<CollectionEditor
				collectionId={collection.id}
				items={collection.items}
				onchange={() => invalidateAll()}
			/>
		</div>
	{:else if entities.length}
		<EntityGrid {entities} showKind caption={(e) => notes.get(e.slug) ?? undefined} />
	{:else}
		<EmptyState title="Коллекция пуста">
			{#if own}Нажмите «Изменить содержимое», чтобы добавить произведения.{:else}Здесь пока ничего
				нет.{/if}
		</EmptyState>
	{/if}
{/if}
