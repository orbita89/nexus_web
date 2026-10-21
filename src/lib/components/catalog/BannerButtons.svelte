<script lang="ts">
	import type { BannerButton } from '#lib/catalog/banners.ts';
	import { isExternal } from '#lib/catalog/bannerHtml.ts';

	let { buttons }: { buttons: BannerButton[] } = $props();

	const STYLE: Record<BannerButton['style'], string> = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		ghost: 'btn-ghost border-white/40 text-white hover:bg-white/15'
	};
</script>

{#if buttons.length}
	<div class="mt-4 flex flex-wrap gap-2">
		{#each buttons as b, i (i)}
			{#if isExternal(b.url)}
				<a href={b.url} target="_blank" rel="noopener" class="btn btn-sm sm:btn-md {STYLE[b.style]}"
					>{b.label}</a
				>
			{:else}
				<a href={b.url} class="btn btn-sm sm:btn-md {STYLE[b.style]}">{b.label}</a>
			{/if}
		{/each}
	</div>
{/if}
