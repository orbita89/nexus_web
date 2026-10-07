<script lang="ts" generics="T extends string">
	import { page } from '$app/state';
	import { filterUrl } from '#lib/catalog/url.ts';

	/** Сортировка ссылками: ?sort=…; значение по умолчанию в адрес не пишется. */
	let {
		options,
		current,
		fallback,
		label
	}: {
		options: readonly { value: T; title: string }[];
		current: T;
		fallback: T;
		label: string;
	} = $props();
</script>

<nav class="tabs tabs-box w-fit tabs-sm" aria-label={label}>
	{#each options as option (option.value)}
		<a
			href={filterUrl(page.url, { sort: option.value === fallback ? null : option.value })}
			data-sveltekit-noscroll
			class={['tab', { 'tab-active': option.value === current }]}
			aria-current={option.value === current ? 'page' : undefined}>{option.title}</a
		>
	{/each}
</nav>
