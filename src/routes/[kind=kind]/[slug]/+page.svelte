<script lang="ts">
	import EntityPage from '#lib/components/card/EntityPage.svelte';
	import type { PageProps } from './$types';

	// Карточка произведения — EntityPage.
	let { data }: PageProps = $props();
</script>

<EntityPage entity={data.entity} />
