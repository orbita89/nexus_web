<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children, footer }: { title: string; children: Snippet; footer?: Snippet } =
		$props();
</script>

<svelte:head>
	<title>{title} — Nexus</title>
</svelte:head>

<div class="mx-auto max-w-sm py-6">
	<div class="card border border-base-300 bg-base-200">
		<div class="card-body gap-4">
			<h1 class="card-title text-2xl">{title}</h1>
			{@render children()}
		</div>
	</div>
	{#if footer}
		<div class="mt-4 text-center text-sm text-base-content/70">{@render footer()}</div>
	{/if}
</div>
