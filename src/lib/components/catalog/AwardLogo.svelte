<script lang="ts">
	// Логотип премии; у большинства его нет — тогда первая буква названия на подложке.
	let {
		title,
		logoUrl,
		size = 'size-12'
	}: { title: string; logoUrl?: string | null; size?: string } = $props();

	let failed = $state(false);
	const letter = $derived(title.trim().charAt(0).toUpperCase());
</script>

{#if logoUrl && !failed}
	<img
		src={logoUrl}
		alt=""
		class="{size} shrink-0 rounded-box object-contain"
		loading="lazy"
		decoding="async"
		onerror={() => (failed = true)}
	/>
{:else}
	<span
		class="{size} flex shrink-0 items-center justify-center rounded-box bg-base-300 text-lg font-black text-base-content/50"
		aria-hidden="true">{letter}</span
	>
{/if}
