<script lang="ts">
	import type { PageProps } from './$types';
	import Stub from '#lib/components/Stub.svelte';

	let { params }: PageProps = $props();
</script>

<Stub
	title={'@' + params.username}
	description="Профиль: рецензии, коллекции, темы, подписки — скоро."
/>
