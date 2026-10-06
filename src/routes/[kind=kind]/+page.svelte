<script lang="ts">
	import type { PageProps } from './$types';
	import Stub from '#lib/components/Stub.svelte';
	import { kindBySlug } from '#lib/catalog/kinds.ts';

	let { params }: PageProps = $props();
</script>

<Stub
	title={kindBySlug(params.kind)!.title}
	description="Список с фильтрами по тегам и годам — скоро."
/>
