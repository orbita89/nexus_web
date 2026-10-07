<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaPersonDetail } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import PersonForm from '#lib/components/admin/PersonForm.svelte';

	let person = $state<SchemaPersonDetail | null>(null);
	let error = $state('');
	let saved = $state(false);
	let confirmDelete = $state(false);

	$effect(() => {
		const slug = page.params.slug!;
		person = null;
		unwrap(api.catalog.GET('/api/v1/catalog/people/{slug}', { params: { path: { slug } } }))
			.then((p) => (person = p))
			.catch((e) => (error = errorMessage(e)));
	});

	async function remove() {
		try {
			await unwrap(
				api.catalog.DELETE('/api/v1/catalog/admin/people/{id}', {
					params: { path: { id: person!.id } }
				})
			);
			await goto('/admin/people');
		} catch (e) {
			error = errorMessage(e);
		}
	}
</script>

<svelte:head><title>{person?.full_name ?? 'Человек'} — Админка — Nexus</title></svelte:head>

<a href="/admin/people" class="link text-sm text-primary link-hover">← Люди</a>
{#if error}<div class="mt-4"><Alert>{error}</Alert></div>{/if}
{#if person}
	<div class="mt-2 mb-6 flex flex-wrap items-baseline justify-between gap-3">
		<h1 class="text-3xl font-black">{person.full_name}</h1>
		<a href="/people/{person.slug}" class="link text-sm link-primary">Открыть на сайте →</a>
	</div>
	{#if saved}<div class="mb-4"><Alert kind="success">Сохранено.</Alert></div>{/if}
	{#key person.id}
		<PersonForm
			initial={{
				slug: person.slug,
				full_name: person.full_name,
				birth_date: person.birth_date ?? '',
				photo_url: person.photo_url ?? '',
				bio: person.bio ?? ''
			}}
			submitLabel="Сохранить"
			onsubmit={async (body) => {
				saved = false;
				try {
					const updated = await unwrap(
						api.catalog.PATCH('/api/v1/catalog/admin/people/{id}', {
							params: { path: { id: person!.id } },
							body
						})
					);
					saved = true;
					if (updated.slug !== page.params.slug)
						await goto(`/admin/people/${updated.slug}`, { replace: true });
					return null;
				} catch (e) {
					return errorMessage(e);
				}
			}}
		/>
	{/key}

	<section class="mt-10 max-w-3xl border-t border-base-300 pt-6">
		<h2 class="font-semibold">Работы: {person.credits.length}</h2>
		<p class="mt-1 text-sm text-base-content/60">Участие правится на странице произведения.</p>
		<div class="mt-4">
			{#if confirmDelete}
				<span class="text-sm"
					>Удалить человека{person.credits.length
						? ' вместе с участием в произведениях'
						: ''}?</span
				>
				<button class="btn btn-error btn-sm" onclick={remove}>Удалить</button>
				<button class="btn btn-ghost btn-sm" onclick={() => (confirmDelete = false)}>Отмена</button>
			{:else}
				<button class="btn btn-outline btn-error btn-sm" onclick={() => (confirmDelete = true)}
					>Удалить человека</button
				>
			{/if}
		</div>
	</section>
{/if}
