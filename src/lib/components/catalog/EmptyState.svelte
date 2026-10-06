<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<div
	role="status"
	class="flex flex-col items-center gap-3 rounded-box border border-dashed border-base-300 px-6 py-16 text-center"
>
	<svg
		class="size-12 text-base-content/20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		aria-hidden="true"
	>
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" />
	</svg>
	<p class="text-lg font-semibold">{title}</p>
	{#if children}<div class="max-w-md text-sm text-base-content/60">{@render children()}</div>{/if}
</div>
