<script lang="ts">
	import EntityPage from '#lib/components/card/EntityPage.svelte';
	import type { PageProps } from './$types';

	// Карточка произведения — EntityPage. У сериала к ней добавляется полоса сезонов.
	let { data }: PageProps = $props();
</script>

<EntityPage entity={data.entity} seasons={data.seasons} />
