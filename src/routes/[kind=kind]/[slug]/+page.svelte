<script lang="ts">
	import EntityPage from '#lib/components/card/EntityPage.svelte';
	import type { PageProps } from './$types';

	// Карточка произведения — EntityPage (её же показывает /archive/{slug} после возврата фильма).
	let { data }: PageProps = $props();
</script>

<EntityPage entity={data.entity} />
