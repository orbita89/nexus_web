<script lang="ts">
	import { page } from '$app/state';

	let {
		title,
		description,
		image
	}: { title: string; description?: string; image?: string | null } = $props();

	const fullTitle = $derived(`${title} — Nexus`);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if description}
		<meta name="description" content={description} />
		<meta property="og:description" content={description} />
	{/if}
	<meta property="og:title" content={title} />
	<meta property="og:site_name" content="Nexus" />
	<meta property="og:url" content={page.url.href} />
	{#if image}<meta property="og:image" content={image} />{/if}
</svelte:head>
