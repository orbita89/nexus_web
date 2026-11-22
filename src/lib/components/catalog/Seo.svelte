<script lang="ts">
	import { page } from '$app/state';
	import { jsonLdScript } from '#lib/catalog/jsonld.ts';
	import { canonicalUrl } from '#lib/catalog/seo.ts';

	let {
		title,
		description,
		image,
		canonical,
		noindex = false,
		type = 'website',
		jsonLd = null,
		preloadImage = false
	}: {
		title: string;
		description?: string;
		image?: string | null;
		/** Свой канонический адрес; по умолчанию — текущий без лишних параметров (seo.ts). */
		canonical?: string;
		/** Страницу не индексировать (выдача поиска), но по ссылкам с неё ходить можно. */
		noindex?: boolean;
		/** og:type: `book`, `video.movie`, … */
		type?: string;
		/** Структурированные данные страницы (schema.org): jsonld.ts. */
		jsonLd?: Record<string, unknown> | null;
		/** Картинка — главная на первом экране: браузер начнёт качать её из <head>, до разметки. */
		preloadImage?: boolean;
	} = $props();

	const fullTitle = $derived(`${title} — Кассандра`);
	// origin при пререндере и ISR — настоящий домен (paths.origin из ORIGIN, см. vite.config.ts).
	const url = $derived(canonical ?? canonicalUrl(page.url, page.url.origin));
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if description}
		<meta name="description" content={description} />
		<meta property="og:description" content={description} />
	{/if}
	<meta property="og:title" content={title} />
	<meta property="og:site_name" content="Кассандра" />
	<!-- Канонический адрес и og:url — один и тот же: ?sort=, ?offset= и метки дублей не создают. -->
	<link rel="canonical" href={url} />
	<meta property="og:url" content={url} />
	{#if noindex}<meta name="robots" content="noindex, follow" />{/if}
	<meta property="og:type" content={type} />
	<meta property="og:locale" content="ru_RU" />
	<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
	{#if image}
		<meta property="og:image" content={image} />
		{#if preloadImage}<link rel="preload" as="image" href={image} fetchpriority="high" />{/if}
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON экранирован в jsonLdScript -->
	{#if jsonLd}{@html jsonLdScript(jsonLd)}{/if}
</svelte:head>
