<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { AWARD_TABS, yearsLabel } from '#lib/catalog/awards.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { filterUrl, withQuery } from '#lib/catalog/url.ts';
	import AwardLogo from '#lib/components/catalog/AwardLogo.svelte';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Pagination from '#lib/components/catalog/Pagination.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	// Премии: вкладки по типам работ и поиск по названию — всё в адресе. Данные неровные:
	// у многих премий нет логотипа и описания, у «Эмми» и The Game Awards — считаные церемонии.
	let { data }: PageProps = $props();

	let text = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const loading = $derived(navigating.to?.url.pathname === page.url.pathname);

	afterNavigate(({ type }) => {
		if (type !== 'goto') text = data.q ?? '';
	});

	function search(delay: number) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (text.trim() === (data.q ?? '')) return;
			goto(filterUrl(page.url, { q: text }), { replace: true, reset: false });
		}, delay);
	}
</script>

<Seo
	title={data.q ? `Награды: ${data.q}` : 'Награды и премии'}
	description="«Оскар», BAFTA, «Хьюго», The Game Awards и другие премии: церемонии по годам, победители и номинанты."
/>

<header class="mb-6">
	<h1 class="text-3xl font-black sm:text-4xl">Награды</h1>
	<p class="mt-1 text-sm text-base-content/50">
		Премии фильмов, сериалов, книг и игр: церемонии по годам, победители и номинанты.
	</p>
</header>

<form
	method="GET"
	action="/awards"
	onsubmit={(e) => {
		e.preventDefault();
		search(0);
	}}
	role="search"
	class="mb-4 flex max-w-lg gap-2"
>
	{#if data.kind}<input type="hidden" name="kind" value={data.kind} />{/if}
	<input
		type="search"
		name="q"
		bind:value={text}
		oninput={() => search(300)}
		placeholder="Название премии"
		aria-label="Поиск по названию премии"
		class="input w-full"
	/>
	<button class="btn btn-primary">Найти</button>
</form>

<nav class="mb-8 overflow-x-auto" aria-label="Тип работ">
	<div class="tabs tabs-box w-fit tabs-sm">
		{#each AWARD_TABS as tab (tab.title)}
			<a
				href={withQuery('/awards', { q: data.q, kind: tab.value })}
				data-sveltekit-noscroll
				class={['tab', { 'tab-active': tab.value === data.kind }]}
				aria-current={tab.value === data.kind ? 'page' : undefined}>{tab.title}</a
			>
		{/each}
	</div>
</nav>

<div class={['transition-opacity', { 'opacity-50': loading }]} aria-busy={loading}>
	{#if data.list.error}
		<LoadError message={data.list.error} />
	{:else if data.list.data?.items.length}
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.list.data.items as award (award.id)}
				{@const years = yearsLabel(award)}
				<li>
					<a
						href="/awards/{award.slug}"
						class="group flex h-full gap-4 rounded-box border border-base-300 p-4 transition-colors hover:border-primary hover:bg-base-200"
					>
						<AwardLogo title={award.title} logoUrl={award.logo_url} />
						<span class="min-w-0 flex-1">
							<span class="block font-bold group-hover:text-primary">{award.title}</span>
							{#if award.full_title}
								<span class="block truncate text-xs text-base-content/50">{award.full_title}</span>
							{/if}
							<span class="mt-2 block text-xs text-base-content/60">
								{#if years}{years}{/if}
								{#if award.editions_count}
									{#if years}<span aria-hidden="true"> · </span>{/if}
									{count(award.editions_count, ['церемония', 'церемонии', 'церемоний'])}
								{/if}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
		<Pagination
			total={data.list.data.total}
			limit={data.list.data.limit}
			offset={data.list.data.offset}
		/>
	{:else}
		<EmptyState title="Премий не нашлось">
			{#if data.q}
				Проверьте написание или <a
					href={withQuery('/awards', { kind: data.kind })}
					class="link link-primary">посмотрите все премии</a
				>.
			{:else}
				В этом разделе премий пока нет — <a href="/awards" class="link link-primary">смотрите все</a
				>.
			{/if}
		</EmptyState>
	{/if}
</div>
