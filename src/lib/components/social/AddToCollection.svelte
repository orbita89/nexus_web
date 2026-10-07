<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import Alert from '#lib/components/Alert.svelte';
	import CollectionForm from './CollectionForm.svelte';

	// «В коллекцию» на карточке: свои коллекции с отметками, где произведение уже есть, и быстрое
	// создание новой. В списке коллекций нет пунктов, поэтому при открытии читаем каждую свою
	// коллекцию (docs/backend-questions.md — нужен признак «есть ли сущность»).
	let { slug, title, onchange }: { slug: string; title: string; onchange?: () => void } = $props();

	let dialog: HTMLDialogElement;
	let collections = $state<SchemaCollection[] | null>(null);
	let member = $state<Record<string, boolean>>({});
	let busy = $state<string | null>(null);
	let error = $state('');
	let creating = $state(false);

	async function load() {
		const username = session.user!.username;
		const list = await unwrap(
			api.social.GET('/api/v1/social/users/{username}/collections', {
				params: { path: { username }, query: { limit: 100 } }
			})
		);
		const details = await Promise.all(
			list.items.map((c) =>
				unwrap(
					api.social.GET('/api/v1/social/collections/{id}', { params: { path: { id: c.id } } })
				)
			)
		);
		member = Object.fromEntries(
			details.map((d) => [d.id, d.items.some((i) => i.entity.slug === slug)])
		);
		collections = list.items;
	}

	async function open() {
		error = '';
		creating = false;
		collections = null;
		dialog.showModal();
		try {
			await load();
		} catch (e) {
			error = errorMessage(e);
		}
	}

	async function toggle(collection: SchemaCollection) {
		const add = !member[collection.id];
		busy = collection.id;
		error = '';
		try {
			const params = { path: { id: collection.id, slug } };
			await unwrap(
				add
					? api.social.PUT('/api/v1/social/collections/{id}/items/{slug}', { params, body: {} })
					: api.social.DELETE('/api/v1/social/collections/{id}/items/{slug}', { params })
			);
			member[collection.id] = add;
			collection.items_count += add ? 1 : -1;
			onchange?.();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = null;
		}
	}

	async function create(form: { title: string; description: string | null; is_public: boolean }) {
		try {
			const created = await unwrap(api.social.POST('/api/v1/social/collections', { body: form }));
			await unwrap(
				api.social.PUT('/api/v1/social/collections/{id}/items/{slug}', {
					params: { path: { id: created.id, slug } },
					body: {}
				})
			);
			creating = false;
			await load();
			onchange?.();
			return null;
		} catch (e) {
			return errorMessage(e);
		}
	}
</script>

{#if session.status === 'guest'}
	<a href={loginUrl(page.url)} class="btn btn-lg">＋ В коллекцию</a>
{:else if session.status === 'authed'}
	<button class="btn btn-lg" onclick={open}>＋ В коллекцию</button>
{/if}

<dialog bind:this={dialog} class="modal" aria-label="Добавить в коллекцию: {title}">
	<div class="modal-box bg-base-200">
		<form method="dialog">
			<button class="btn absolute top-3 right-3 btn-circle btn-ghost btn-sm" aria-label="Закрыть"
				>✕</button
			>
		</form>
		<h2 class="pr-10 text-lg font-bold">В коллекцию: {title}</h2>
		{#if error}<div class="mt-3"><Alert>{error}</Alert></div>{/if}

		{#if collections === null && !error}
			<div class="mt-4 h-24 skeleton"></div>
		{:else if collections}
			{#if collections.length}
				<ul class="mt-4 flex flex-col gap-1" aria-label="Мои коллекции">
					{#each collections as collection (collection.id)}
						<li>
							<label
								class="flex cursor-pointer items-center gap-3 rounded-box px-3 py-2 hover:bg-base-300"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm checkbox-primary"
									checked={member[collection.id]}
									disabled={busy === collection.id}
									onchange={() => toggle(collection)}
								/>
								<span class="min-w-0 flex-1">
									<span class="block truncate font-medium">{collection.title}</span>
									<span class="text-xs text-base-content/50">
										{count(collection.items_count, [
											'произведение',
											'произведения',
											'произведений'
										])}
										{#if !collection.is_public}· личная{/if}
									</span>
								</span>
							</label>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-4 text-sm text-base-content/60">Коллекций пока нет — создайте первую.</p>
			{/if}

			<div class="mt-4 border-t border-base-300 pt-4">
				{#if creating}
					<CollectionForm
						compact
						submitLabel="Создать и добавить"
						onsubmit={create}
						oncancel={() => (creating = false)}
					/>
				{:else}
					<button class="btn btn-ghost btn-sm" onclick={() => (creating = true)}
						>＋ Новая коллекция</button
					>
				{/if}
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop"><button tabindex="-1">Закрыть</button></form>
</dialog>
