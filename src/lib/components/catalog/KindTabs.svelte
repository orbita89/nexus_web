<script lang="ts">
	import { page } from '$app/state';
	import { KINDS, kindsParam } from '#lib/catalog/kinds.ts';
	import { filterUrl } from '#lib/catalog/url.ts';

	/** Фильтр по разделам ссылками: ?kind=films,games. Выбранные — из адреса; «Все» снимает выбор. */
	let { current = [] }: { current?: readonly { slug: string }[] } = $props();

	const chosen = $derived(new Set(current.map((k) => k.slug)));

	/** Ссылка вкладки: выбранную снимает, невыбранную добавляет к остальным. */
	function toggleUrl(slug: string) {
		const next = KINDS.filter((k) => (k.slug === slug ? !chosen.has(slug) : chosen.has(k.slug)));
		return filterUrl(page.url, { kind: kindsParam(next) });
	}
</script>

<nav class="tabs tabs-box w-fit tabs-sm" aria-label="Раздел">
	<a
		href={filterUrl(page.url, { kind: null })}
		class={['tab', { 'tab-active': chosen.size === 0 }]}
		aria-current={chosen.size === 0 ? 'page' : undefined}>Все</a
	>
	{#each KINDS as tab (tab.slug)}
		<a
			href={toggleUrl(tab.slug)}
			class={['tab', { 'tab-active': chosen.has(tab.slug) }]}
			aria-current={chosen.has(tab.slug) ? 'page' : undefined}>{tab.title}</a
		>
	{/each}
</nav>
