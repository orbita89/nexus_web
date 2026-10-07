<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, guestApi, session } from '#lib/auth/session.svelte.ts';
	import { canCreateThreads } from '#lib/social/forum.ts';
	import Alert from '#lib/components/Alert.svelte';
	import type { PickedEntity } from '#lib/components/social/EntityPicker.svelte';
	import ThreadForm from '#lib/components/social/ThreadForm.svelte';

	// /forum/new?entity=dune-2021 — «Начать обсуждение» с карточки: произведение уже выбрано.
	const slug = page.url.searchParams.get('entity');
	let initial = $state<PickedEntity[] | null>(slug ? null : []);

	if (slug) {
		unwrap(guestApi.catalog.GET('/api/v1/catalog/entities/{slug}', { params: { path: { slug } } }))
			.then((e) => (initial = [e]))
			.catch(() => (initial = []));
	}

	async function create(form: { title: string; body: string; entities: string[] }) {
		try {
			const thread = await unwrap(api.social.POST('/api/v1/social/threads', { body: form }));
			await goto(`/forum/${thread.id}`);
			return null;
		} catch (e) {
			return errorMessage(e);
		}
	}
</script>

<svelte:head><title>Новая тема — Форум — Nexus</title></svelte:head>

<a href="/forum" class="link text-sm text-primary link-hover">← Форум</a>
<h1 class="mt-2 mb-6 text-3xl font-black">Новая тема</h1>

{#if !canCreateThreads(session.user?.role)}
	<Alert kind="info">
		Темы создают авторы. Отвечать в темах и писать рецензии может каждый — загляните на
		<a href="/forum" class="link">форум</a>.
	</Alert>
{:else if initial === null}
	<span class="loading loading-spinner"></span>
{:else}
	<ThreadForm entities={initial} submitLabel="Создать тему" onsubmit={create} />
{/if}
