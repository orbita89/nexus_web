<script lang="ts">
	import { page } from '$app/state';
	import { pageLinks, pageUrl } from '#lib/catalog/url.ts';

	let { total, limit, offset }: { total: number; limit: number; offset: number } = $props();

	const links = $derived(pageLinks(total, limit, offset));
	const currentIndex = $derived(links.findIndex((l) => l?.current));
	const prev = $derived(offset > 0 ? Math.max(0, offset - limit) : null);
	const next = $derived(offset + limit < total ? offset + limit : null);
</script>

{#if total > limit}
	<nav class="mt-10 flex flex-col items-center gap-2" aria-label="Страницы">
		<div class="join">
			{#if prev !== null}
				<a class="btn join-item btn-sm" href={pageUrl(page.url, prev)} aria-label="Предыдущая">‹</a>
			{/if}
			{#each links as link, i (link ? link.number : `gap-${i}`)}
				{#if link}
					<a
						class={['btn join-item btn-sm', { 'btn-primary': i === currentIndex }]}
						href={pageUrl(page.url, link.offset)}
						aria-current={link.current ? 'page' : undefined}
						aria-label="Страница {link.number}">{link.number}</a
					>
				{:else}
					<span class="btn btn-disabled join-item btn-sm" aria-hidden="true">…</span>
				{/if}
			{/each}
			{#if next !== null}
				<a class="btn join-item btn-sm" href={pageUrl(page.url, next)} aria-label="Следующая">›</a>
			{/if}
		</div>
		<p class="text-xs text-base-content/50">
			{offset + 1}–{Math.min(offset + limit, total)} из {total}
		</p>
	</nav>
{/if}
