<script lang="ts">
	import { displayName } from '#lib/social/reviews.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);
</script>

<Seo title="Коллекции — {displayName(user)} (@{user.username})" />
<h2 class="sr-only">Коллекции</h2>
<EmptyState title="Коллекции — скоро"
	>Списки фильмов, книг и игр появятся в следующем обновлении.</EmptyState
>
