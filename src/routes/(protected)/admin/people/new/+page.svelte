<script lang="ts">
	import { goto } from '$app/navigation';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import PersonForm from '#lib/components/admin/PersonForm.svelte';
</script>

<svelte:head><title>Новый человек — Админка — Nexus</title></svelte:head>

<a href="/admin/people" class="link text-sm text-primary link-hover">← Люди</a>
<h1 class="mt-2 mb-6 text-3xl font-black">Новый человек</h1>
<PersonForm
	submitLabel="Добавить"
	onsubmit={async (body) => {
		try {
			const person = await unwrap(api.catalog.POST('/api/v1/catalog/admin/people', { body }));
			await goto(`/admin/people/${person.slug}`);
			return null;
		} catch (e) {
			return errorMessage(e);
		}
	}}
/>
