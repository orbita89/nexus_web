<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';
	import CollectionForm from './CollectionForm.svelte';

	// «Создать коллекцию»: форма раскрывается на месте, после создания — на страницу коллекции.
	let opened = $state(false);

	async function create(form: { title: string; description: string | null; is_public: boolean }) {
		try {
			const created = await unwrap(api.social.POST('/api/v1/social/collections', { body: form }));
			await goto(`/collections/${created.id}`);
			return null;
		} catch (e) {
			return errorMessage(e);
		}
	}
</script>

{#if session.status === 'guest'}
	<a href={loginUrl(page.url)} class="btn btn-primary">Создать коллекцию</a>
{:else if session.status === 'authed'}
	{#if opened}
		<div class="w-full max-w-lg rounded-box bg-base-200 p-4 ring-1 ring-base-300">
			<CollectionForm submitLabel="Создать" onsubmit={create} oncancel={() => (opened = false)} />
		</div>
	{:else}
		<button class="btn btn-primary" onclick={() => (opened = true)}>Создать коллекцию</button>
	{/if}
{/if}
