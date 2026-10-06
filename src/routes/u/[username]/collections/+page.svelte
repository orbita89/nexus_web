<script lang="ts">
	import type { PageProps } from './$types';
	import Stub from '#lib/components/Stub.svelte';

	let { params }: PageProps = $props();
</script>

<Stub title={`Коллекции @${params.username}`} />
