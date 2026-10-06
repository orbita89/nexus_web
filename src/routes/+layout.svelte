<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Navbar from '#lib/components/Navbar.svelte';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Nexus</title>
</svelte:head>

<div class="relative isolate flex min-h-screen flex-col overflow-x-clip">
	<Navbar />
	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
		{@render children()}
	</main>
	<footer class="mt-10 border-t border-base-300 bg-base-200/40">
		<div
			class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-base-content/50 sm:flex-row sm:items-center sm:justify-between"
		>
			<p>
				<span class="font-black tracking-widest text-base-content uppercase">Nexus</span>
				<span class="text-primary">·</span> фильмы, сериалы, книги и игры
			</p>
			<nav aria-label="Каталог" class="flex flex-wrap gap-x-4 gap-y-1">
				{#each KINDS as k (k.slug)}
					<a href="/{k.slug}" class="link link-hover">{k.title}</a>
				{/each}
				<a href="/people" class="link link-hover">Люди</a>
				<a href="/tags" class="link link-hover">Теги</a>
			</nav>
		</div>
	</footer>
</div>
