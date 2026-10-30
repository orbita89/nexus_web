<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Navbar from '#lib/components/Navbar.svelte';
	import ReplyToasts from '#lib/components/social/ReplyToasts.svelte';
	import ChatPanel from '#lib/components/chat/ChatPanel.svelte';
	import { chat } from '#lib/chat/chat.svelte.ts';
	import { syncRealtimeAuth } from '#lib/realtime/realtime.svelte.ts';
	import { dropLegacyStorage } from '#lib/utils/legacy-storage.ts';
	import { onMount } from 'svelte';
	import { KINDS } from '#lib/catalog/kinds.ts';
	import BannerCarousel from '#lib/components/catalog/BannerCarousel.svelte';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// Реалтайм-соединение входит и выходит вместе с сессией.
	syncRealtimeAuth();
	onMount(() => {
		try {
			dropLegacyStorage(localStorage);
		} catch {
			// localStorage недоступен (приватный режим) — чистить нечего
		}
	});
	// Страница особой коллекции — спецпроект на всю страницу: подвал сайта не показываем.
	const hideFooter = $derived(
		(page.data as { collection?: { is_featured?: boolean } | null }).collection?.is_featured ===
			true
	);
	const isAdmin = $derived(
		page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/')
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Кассандра</title>
</svelte:head>

<!-- Шапка — во всю ширину окна, над панелью чата: кнопка чата и профиль в самом углу. -->
<Navbar />
<!-- Справа закреплена панель чата: на десктопе контент сдвигается на её ширину. -->
<div
	class={[
		// @container: от него считают ширину шапки карточки (100cqw) — чтобы она занимала страницу
		// без панели чата, а не всё окно.
		'@container relative isolate flex min-h-screen flex-col overflow-x-clip',
		chat.collapsed ? 'lg:pr-16' : 'lg:pr-80'
	]}
>
	<!-- Фиолетовый отсвет от «Кассандры» держится на фоне всей страницы, куда бы её ни пролистали. -->
	<div
		class="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(70%_55%_at_75%_12%,rgba(139,92,246,0.18),transparent_72%),radial-gradient(60%_50%_at_8%_75%,rgba(109,76,235,0.13),transparent_72%)]"
		aria-hidden="true"
	></div>
	<!-- Красные пятна — отдельным слоем: еле заметные, «мухоморные», и очень медленно дышат
	     (полминуты на цикл), чтобы фон переливался, а не мигал. Движение — только opacity и
	     transform, они не вызывают перерисовку страницы. -->
	<div
		class="embers pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(34%_26%_at_88%_34%,rgba(200,38,48,0.1),transparent_70%),radial-gradient(28%_22%_at_16%_58%,rgba(186,32,46,0.07),transparent_70%)]"
		aria-hidden="true"
	></div>
	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
		<!-- Баннеры по пути страницы (+layout.server.ts); в админке не показываем. -->
		{#if !isAdmin}
			<BannerCarousel banners={data.banners} />
		{/if}
		{@render children()}
	</main>
	{#if !hideFooter}
		<footer class="mt-10 border-t border-base-300 bg-base-200/40">
			<div
				class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-base-content/50 sm:flex-row sm:items-center sm:justify-between"
			>
				<p>
					<a
						href="/about"
						class="font-black tracking-widest text-base-content uppercase hover:text-primary"
						>Кассандра</a
					>
					<span class="text-primary">·</span> фильмы, сериалы, книги и игры
				</p>
				<nav aria-label="Каталог" class="flex flex-wrap gap-x-4 gap-y-1">
					{#each KINDS as k (k.slug)}
						<a href="/{k.slug}" class="link link-hover">{k.title}</a>
					{/each}
					<a href="/people" class="link link-hover">Люди</a>
					<a href="/collections" class="link link-hover">Коллекции</a>
					<a href="/forum" class="link link-hover">Форум</a>
					<a href="/tags" class="link link-hover">Теги</a>
				</nav>
				<p class="text-xs">
					<a href="/about" class="link link-hover">О приложении</a>
					<span class="mx-1 text-base-content/30">·</span>
					Постеры:
					<a href="https://www.themoviedb.org/" class="link link-hover" rel="noopener external"
						>TMDB</a
					>
				</p>
			</div>
		</footer>
	{/if}
	<ReplyToasts />
</div>
<ChatPanel />

<style>
	/* Красный отсвет переливается: пятна чуть расходятся и меняют силу. Полный цикл — 36 с,
	   поэтому движение замечаешь, только если задержаться на странице. */
	@keyframes embers {
		0% {
			opacity: 0.75;
			transform: scale(1) translate3d(0, 0, 0);
		}
		50% {
			opacity: 1;
			transform: scale(1.12) translate3d(-1.5%, 1%, 0);
		}
		100% {
			opacity: 0.75;
			transform: scale(1) translate3d(0, 0, 0);
		}
	}

	.embers {
		animation: embers 36s ease-in-out infinite;
		will-change: opacity, transform;
	}

	/* Кому движение мешает — ровный фон без анимации. */
	@media (prefers-reduced-motion: reduce) {
		.embers {
			animation: none;
		}
	}
</style>
