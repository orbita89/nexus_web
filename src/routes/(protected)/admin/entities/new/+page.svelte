<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import EntityForm from '#lib/components/admin/EntityForm.svelte';

	const kind = (KINDS.find((k) => k.kind === page.url.searchParams.get('kind'))?.kind ??
		'movie') as SchemaEntityKind;
</script>

<svelte:head><title>Новое произведение — Админка — Nexus</title></svelte:head>

<a href="/admin/entities" class="link text-sm text-primary link-hover">← Произведения</a>
<h1 class="mt-2 mb-6 text-3xl font-black">Новое произведение</h1>
<EntityForm
	{kind}
	submitLabel="Создать"
	onsubmit={async (body) => {
		try {
			const entity = await unwrap(api.catalog.POST('/api/v1/catalog/admin/entities', { body }));
			await goto(`/admin/entities/${entity.slug}`);
			return null;
		} catch (e) {
			return errorMessage(e);
		}
	}}
/>
