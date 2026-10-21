<script lang="ts">
	import type { BannerButton } from '#lib/catalog/banners.ts';
	import { isExternal } from '#lib/catalog/bannerHtml.ts';

	let { buttons }: { buttons: BannerButton[] } = $props();

	// Компактно: primary/secondary — маленькие кнопки, ghost — просто ссылка со стрелкой.
	const STYLE: Record<BannerButton['style'], string> = {
		primary: 'btn btn-sm btn-primary',
		secondary: 'btn btn-sm btn-secondary',
		ghost: 'link text-sm font-medium link-hover opacity-90 hover:opacity-100 after:content-["_→"]'
	};
</script>

{#if buttons.length}
	<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
		{#each buttons as b, i (i)}
			{#if isExternal(b.url)}
				<a href={b.url} target="_blank" rel="noopener" class={STYLE[b.style]}>{b.label}</a>
			{:else}
				<a href={b.url} class={STYLE[b.style]}>{b.label}</a>
			{/if}
		{/each}
	</div>
{/if}
