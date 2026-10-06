<script lang="ts">
	import type { PageProps } from './$types';
	import Stub from '#lib/components/Stub.svelte';

	let { params }: PageProps = $props();
</script>

<Stub
	title={params.slug}
	description="Карточка: постер, участники, оценки, рецензии, темы форума и коллекции — скоро."
/>
