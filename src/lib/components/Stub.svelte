<script lang="ts">
	let { title, description }: { title: string; description?: string } = $props();
</script>

<svelte:head>
	<title>{title} — Nexus</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">{title}</h1>
<div role="status" class="alert">
	<span>{description ?? 'Раздел в разработке.'}</span>
</div>
