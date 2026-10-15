<script lang="ts">
	// Логотип студии — PNG с прозрачностью, часто тёмный: на светлой подложке в любой теме. Название
	// всегда написано рядом, поэтому alt пустой. Нет логотипа или не загрузился — ничего не рисуем.
	let { url, size = 'sm' }: { url?: string | null; size?: 'sm' | 'lg' } = $props();

	let failed = $state(false);
</script>

{#if url && !failed}
	<span
		class={[
			'inline-flex shrink-0 items-center justify-center bg-white ring-1 ring-base-content/10',
			size === 'sm' ? 'h-5 w-8 rounded-sm px-0.5' : 'h-24 w-40 rounded-box p-3 sm:h-28 sm:w-48'
		]}
	>
		<img
			src={url}
			alt=""
			loading={size === 'sm' ? 'lazy' : 'eager'}
			decoding="async"
			class="max-h-full max-w-full object-contain"
			onerror={() => (failed = true)}
		/>
	</span>
{/if}
