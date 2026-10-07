<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { fromMetadata } from '#lib/admin/entity-form.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import Alert from '#lib/components/Alert.svelte';
	import CreditsEditor from '#lib/components/admin/CreditsEditor.svelte';
	import EntityForm from '#lib/components/admin/EntityForm.svelte';

	let entity = $state<SchemaEntityDetail | null>(null);
	let error = $state('');
	let saved = $state(false);
	let confirmDelete = $state(false);

	async function load(slug: string) {
		try {
			entity = await unwrap(
				api.catalog.GET('/api/v1/catalog/entities/{slug}', { params: { path: { slug } } })
			);
		} catch (e) {
			error = errorMessage(e);
		}
	}
	$effect(() => {
		entity = null;
		void load(page.params.slug!);
	});

	type Body = Parameters<ComponentProps<typeof EntityForm>['onsubmit']>[0];

	async function save(body: Body) {
		saved = false;
		const current = entity!;
		// kind не меняется (в UpdateEntity его нет), теги — отдельным запросом.
		const { tags, ...rest } = body;
		const fields = { ...rest, kind: undefined };
		try {
			// Поля — PATCH (kind не меняется), теги — отдельным PUT, если изменились.
			const updated = await unwrap(
				api.catalog.PATCH('/api/v1/catalog/admin/entities/{id}', {
					params: { path: { id: current.id } },
					body: fields
				})
			);
			const before = current.tags
				.map((t) => t.slug)
				.toSorted()
				.join();
			if (tags.toSorted().join() !== before) {
				await unwrap(
					api.catalog.PUT('/api/v1/catalog/admin/entities/{id}/tags', {
						params: { path: { id: current.id } },
						body: { tags }
					})
				);
			}
			saved = true;
			if (updated.slug !== current.slug)
				await goto(`/admin/entities/${updated.slug}`, { replace: true });
			else await load(updated.slug);
			return null;
		} catch (e) {
			return errorMessage(e);
		}
	}

	async function remove() {
		try {
			await unwrap(
				api.catalog.DELETE('/api/v1/catalog/admin/entities/{id}', {
					params: { path: { id: entity!.id } }
				})
			);
			await goto('/admin/entities');
		} catch (e) {
			error = errorMessage(e);
		}
	}
</script>

<svelte:head><title>{entity?.title ?? 'Произведение'} — Админка — Nexus</title></svelte:head>

<a href="/admin/entities" class="link text-sm text-primary link-hover">← Произведения</a>
{#if error}<div class="mt-4"><Alert>{error}</Alert></div>{/if}
{#if entity}
	<div class="mt-2 mb-6 flex flex-wrap items-baseline justify-between gap-3">
		<h1 class="text-3xl font-black">{entity.title}</h1>
		<a href={entityHref(entity)} class="link text-sm link-primary">Открыть на сайте →</a>
	</div>
	{#if saved}<div class="mb-4"><Alert kind="success">Сохранено.</Alert></div>{/if}
	{#key entity.id}
		<EntityForm
			initial={{
				kind: entity.kind,
				slug: entity.slug,
				title: entity.title,
				original_title: entity.original_title ?? '',
				release_date: entity.release_date ?? '',
				description: entity.description ?? '',
				cover_url: entity.cover_url ?? '',
				metadata: fromMetadata(entity.kind, entity.metadata),
				tags: entity.tags.map((t) => t.slug)
			}}
			submitLabel="Сохранить"
			onsubmit={save}
		/>
	{/key}

	<div class="mt-10 max-w-3xl">
		<CreditsEditor
			entityId={entity.id}
			credits={entity.credits}
			onchange={() => load(entity!.slug)}
		/>
	</div>

	<section class="mt-10 max-w-3xl border-t border-base-300 pt-6">
		<h2 class="font-semibold text-error">Удаление</h2>
		<p class="mt-1 text-sm text-base-content/60">
			Вместе с произведением удаляются теги, участники, рецензии и пункты коллекций. Темы форума
			остаются, но без этого произведения.
		</p>
		<div class="mt-3">
			{#if confirmDelete}
				<span class="text-sm">Удалить «{entity.title}» насовсем?</span>
				<button class="btn btn-error btn-sm" onclick={remove}>Удалить</button>
				<button class="btn btn-ghost btn-sm" onclick={() => (confirmDelete = false)}>Отмена</button>
			{:else}
				<button class="btn btn-outline btn-error btn-sm" onclick={() => (confirmDelete = true)}
					>Удалить произведение</button
				>
			{/if}
		</div>
	</section>
{/if}
