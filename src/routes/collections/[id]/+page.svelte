<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { asKind } from '#lib/catalog/kinds.ts';
	import { count, summary } from '#lib/catalog/labels.ts';
	import {
		FEATURED_PRIVATE_ERROR,
		adminUpdateCollection,
		collectionTextError,
		editsAsAdmin,
		updateCollectionText,
		isFeaturedMustBePublic
	} from '#lib/social/collections.ts';
	import { displayName, reviewDate } from '#lib/social/reviews.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import EntityGrid from '#lib/components/catalog/EntityGrid.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import CollectionEnd from '#lib/components/social/CollectionEnd.svelte';
	import CollectionEditor from '#lib/components/social/CollectionEditor.svelte';
	import CollectionItemSearch from '#lib/components/social/CollectionItemSearch.svelte';
	import CollectionForm from '#lib/components/social/CollectionForm.svelte';
	import FeaturedCollectionView from '#lib/components/social/FeaturedCollectionView.svelte';
	import FeaturedAdminControls from '#lib/components/social/FeaturedAdminControls.svelte';
	import RelatedCollectionsEditor from '#lib/components/social/RelatedCollectionsEditor.svelte';
	import ModerateButton from '#lib/components/social/ModerateButton.svelte';
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
	// Админ правит состав чужой особой коллекции через админские пути.
	const asAdmin = $derived(
		!!collection && session.status === 'authed' && editsAsAdmin(collection, session.user)
	);
	const canEditItems = $derived(own || asAdmin);
	// EntityRef → карточка постера; заметка владельца — подписью.
	const entities = $derived(
		(collection?.items ?? []).flatMap((item): SchemaEntitySummary[] => {
			const kind = asKind(item.entity.kind);
			return kind ? [{ ...item.entity, kind }] : [];
		})
	);
	const notes = $derived(new Map(collection?.items.map((i) => [i.entity.slug, i.note]) ?? []));

	let mode = $state<'view' | 'edit' | 'items' | 'delete'>('view');
	// Админ: панель «Оформление» (обои, обложка, тема, адрес) особой коллекции.
	let styling = $state(false);
	// Админ: панель «Связанные подборки» (ручные связи для блока «Похожие подборки»).
	let linking = $state(false);
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
			return isFeaturedMustBePublic(e) ? FEATURED_PRIVATE_ERROR : errorMessage(e);
		}
	}

	// Название/описание прямо в шапке особой коллекции: владелец — PATCH /collections/{id},
	// админ (не владелец) — PATCH /admin/collections/{id}.
	const editText = $derived(own || asAdmin);

	async function saveText(form: { title: string; description: string }) {
		try {
			if (own) await updateCollectionText(api, collection!.id, form);
			else await adminUpdateCollection(api, collection!.id, form);
			await invalidateAll();
			return null;
		} catch (e) {
			return collectionTextError(e, errorMessage);
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

{#snippet controls()}
	{#if collection}
		{#if !own && session.user?.role === 'admin'}
			<div class="mt-4">
				<ModerateButton
					label="Удалить коллекцию"
					question="Удалить чужую коллекцию?"
					action={async () => {
						await unwrap(
							api.social.DELETE('/api/v1/social/admin/collections/{id}', {
								params: { path: { id: collection.id } }
							})
						);
						await goto('/collections');
					}}
				/>
			</div>
		{/if}
		{#if canEditItems && mode !== 'edit'}
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<button
					class={['btn btn-sm', mode === 'items' ? 'btn-primary' : '']}
					onclick={() => (mode = mode === 'items' ? 'view' : 'items')}
					>{mode === 'items' ? 'Готово' : 'Изменить содержимое'}</button
				>
				{#if collection.is_featured && session.user?.role === 'admin'}
					<button
						class={['btn btn-sm', styling ? 'btn-primary' : '']}
						aria-expanded={styling}
						onclick={() => (styling = !styling)}>Оформление</button
					>
				{/if}
				{#if collection.is_public && session.user?.role === 'admin'}
					<button
						class={['btn btn-sm', linking ? 'btn-primary' : '']}
						aria-expanded={linking}
						onclick={() => (linking = !linking)}
						>Связанные подборки{collection.related?.length
							? ` (${collection.related.length})`
							: ''}</button
					>
				{/if}
				{#if !own}
					<span class="text-xs text-base-content/60">Правка состава как администратор</span>
				{:else}
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
				{/if}
			</div>
			{#if error}<div class="mt-2"><Alert>{error}</Alert></div>{/if}
			{#if linking && collection.is_public}
				<div class="mt-3 max-w-2xl rounded-box bg-base-200 p-4 ring-1 ring-base-300">
					<p class="mb-2 text-sm font-semibold">Связанные подборки</p>
					<RelatedCollectionsEditor collectionId={collection.id} onchange={() => invalidateAll()} />
				</div>
			{/if}
			{#if styling && collection.is_featured}
				<div class="mt-3 max-w-2xl space-y-4 rounded-box bg-base-200 p-4 ring-1 ring-base-300">
					{#if collection.is_featured}
						<div>
							<p class="mb-2 text-sm font-semibold">Оформление: обои, обложка, тема</p>
							<FeaturedAdminControls {collection} onchange={() => invalidateAll()} />
						</div>
					{/if}
				</div>
			{/if}
			{#if mode !== 'items'}
				<CollectionItemSearch
					collectionId={collection.id}
					slugs={collection.items.map((i) => i.entity.slug)}
					{asAdmin}
					onchange={() => invalidateAll()}
				/>
			{/if}
		{/if}
	{/if}
{/snippet}

{#if !collection}
	<div class="h-40 skeleton" aria-label="Загрузка коллекции"></div>
{:else if collection.is_featured && mode !== 'edit' && mode !== 'items'}
	<!-- Особая коллекция: свой вид и SEO (см. buildFeaturedUrl — будущий /top/{slug}). -->
	<FeaturedCollectionView
		{collection}
		others={data.others}
		actions={controls}
		{editText}
		onsavetext={saveText}
	/>
{:else}
	<Seo
		title={collection.title}
		description={summary(collection.description) ||
			`Коллекция @${collection.owner.username} в Кассандра: ${count(collection.items_count, ['произведение', 'произведения', 'произведений'])}.`}
	/>

	<header class="mb-8">
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
			<h1 class="text-3xl font-black sm:text-4xl">
				<span
					class="mr-1 align-middle text-2xl text-base-content/50"
					role="img"
					aria-label="Коллекция"
					title="Коллекция">🔖</span
				>
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
		<div class="mt-3"><FeaturedAdminControls {collection} onchange={() => invalidateAll()} /></div>
		<div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-base-content/60">
			<a href="/u/{collection.owner.username}" class="flex items-center gap-2 hover:text-primary">
				<Avatar user={collection.owner} size="w-7" />
				<span class="font-semibold text-base-content">{displayName(collection.owner)}</span>
			</a>
			<span>·</span>
			<span>{count(collection.items_count, ['произведение', 'произведения', 'произведений'])}</span>
		</div>
		<p class="mt-2 text-right text-xs text-base-content/45">
			обновлена {reviewDate(collection.updated_at)}
		</p>

		{@render controls()}
	</header>

	{#if canEditItems && mode === 'items'}
		<div class="max-w-3xl">
			<CollectionEditor
				collectionId={collection.id}
				items={collection.items}
				{asAdmin}
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
	{#if mode !== 'items'}
		<CollectionEnd
			{collection}
			others={data.others}
			shareUrl={page.url.origin + buildFeaturedUrl(collection)}
			shareTitle={collection.title}
		/>
	{/if}
{/if}
