<script lang="ts">
	import { page } from '$app/state';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import { filterUrl } from '#lib/catalog/url.ts';

	/** Фильтр по разделу ссылками: ?kind=films. Выбранный раздел — из адреса. */
	let { current }: { current?: string } = $props();

	const tabs = [{ slug: undefined, title: 'Все' }, ...KINDS];
</script>

<nav class="tabs tabs-box w-fit tabs-sm" aria-label="Раздел">
	{#each tabs as tab (tab.slug ?? 'all')}
		<a
			href={filterUrl(page.url, { kind: tab.slug })}
			class={['tab', { 'tab-active': tab.slug === current }]}
			aria-current={tab.slug === current ? 'page' : undefined}>{tab.title}</a
		>
	{/each}
</nav>
