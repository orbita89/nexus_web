<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Navbar from '#lib/components/Navbar.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Nexus</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Navbar />
	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
		{@render children()}
	</main>
	<footer class="footer footer-center border-t border-base-300 p-4 text-sm text-base-content/60">
		<p>Nexus — фильмы, сериалы, книги и игры</p>
	</footer>
</div>
