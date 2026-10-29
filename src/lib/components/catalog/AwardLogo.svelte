<script lang="ts">
	// Логотип премии. У большинства его нет (logo_url пустой) — тогда статуэтка на подложке
	// в цветах темы и первая буква названия: так плитки премий не выглядят пустыми.
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
		class="{size} relative flex shrink-0 items-center justify-center overflow-hidden rounded-box bg-linear-to-br from-primary/35 to-base-300 ring-1 ring-base-content/10"
		aria-hidden="true"
	>
		<svg
			class="size-1/2 text-base-content/30"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
		>
			<path
				d="M8 3h8v5a4 4 0 0 1-8 0zM8 4H5v2a3 3 0 0 0 3 3M16 4h3v2a3 3 0 0 1-3 3M12 12v4M9 20h6M10 16h4l1 4H9z"
			/>
		</svg>
		<span
			class="absolute inset-0 flex items-end justify-center pb-0.5 text-[0.6em] font-black text-base-content/55"
			>{letter}</span
		>
	</span>
{/if}
