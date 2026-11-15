<script lang="ts">
	import { page } from '$app/state';
	import { KINDS, kindsParam } from '#lib/catalog/kinds.ts';
	import { filterUrl } from '#lib/catalog/url.ts';

	/** Фильтр по разделам ссылками: ?kind=films,games. Выбранные — из адреса; «Все» снимает выбор. */
	let {
		current = [],
		single = false,
		hideAll = false,
		available
	}: {
		/** Типы работ, которые есть в выдаче (например, `by_kind` тега): остальные вкладки скрыты. */
		/** Не показывать вкладку «Все». */
		hideAll?: boolean;
		available?: Readonly<Record<string, number>>;
		current?: readonly { slug: string }[];
		/** Ровно один раздел или «Все»: выбор вкладки заменяет прежний, а не добавляется к нему. */
		single?: boolean;
	} = $props();

	const chosen = $derived(new Set(current.map((k) => k.slug)));
	const tabs = $derived(
		available
			? KINDS.filter(
					(k) =>
						chosen.has(k.slug) ||
						(available[k.kind] ?? 0) > 0 ||
						(k.kind === 'series' && (available.season ?? 0) > 0)
				)
			: KINDS
	);

	/** Ссылка вкладки: выбранную снимает, невыбранную добавляет к остальным (в single — заменяет). */
	function toggleUrl(slug: string) {
		const next = single
			? KINDS.filter((k) => k.slug === slug && !chosen.has(slug))
			: KINDS.filter((k) => (k.slug === slug ? !chosen.has(slug) : chosen.has(k.slug)));
		return filterUrl(page.url, { kind: kindsParam(next) });
	}
</script>

<nav class="tabs tabs-box w-fit tabs-sm" aria-label="Раздел">
	{#if !hideAll}<a
			href={filterUrl(page.url, { kind: null })}
			class={['tab', { 'tab-active': chosen.size === 0 }]}
			aria-current={chosen.size === 0 ? 'page' : undefined}>Все</a
		>{/if}
	{#each tabs as tab (tab.slug)}
		<a
			href={toggleUrl(tab.slug)}
			class={['tab', { 'tab-active': chosen.has(tab.slug) }]}
			aria-current={chosen.has(tab.slug) ? 'page' : undefined}>{tab.title}</a
		>
	{/each}
</nav>
