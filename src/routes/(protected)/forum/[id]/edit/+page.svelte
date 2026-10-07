<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaThreadDetail } from '#lib/api/generated/social.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import ThreadForm from '#lib/components/social/ThreadForm.svelte';

	// Править тему может только её автор (даже admin — нет: он только закрывает и удаляет).
	const id = page.params.id!;
	let thread = $state<SchemaThreadDetail | null>(null);
	let loadError = $state('');

	unwrap(
		api.social.GET('/api/v1/social/threads/{id}', { params: { path: { id }, query: { limit: 1 } } })
	)
		.then((t) => (thread = t))
		.catch((e) => (loadError = errorMessage(e)));

	async function save(form: { title: string; body: string; entities: string[] }) {
		try {
			await unwrap(
				api.social.PATCH('/api/v1/social/threads/{id}', { params: { path: { id } }, body: form })
			);
			await goto(`/forum/${id}`);
			return null;
		} catch (e) {
			return errorMessage(e);
		}
	}
</script>

<svelte:head><title>Изменить тему — Форум — Nexus</title></svelte:head>

<a href="/forum/{id}" class="link text-sm text-primary link-hover">← К теме</a>
<h1 class="mt-2 mb-6 text-3xl font-black">Изменить тему</h1>

{#if loadError}
	<Alert>{loadError}</Alert>
{:else if !thread}
	<span class="loading loading-spinner"></span>
{:else if thread.author.id !== session.user?.id}
	<Alert kind="info">Изменить тему может только её автор.</Alert>
{:else}
	<ThreadForm
		title={thread.title}
		body={thread.body}
		entities={thread.entities}
		submitLabel="Сохранить"
		onsubmit={save}
	/>
{/if}
