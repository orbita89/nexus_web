<script lang="ts">
	import { originalTitle, tmdbHref } from '#lib/admin/archive.ts';
	import { Promotions } from '#lib/admin/promote.svelte.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import Alert from '#lib/components/Alert.svelte';
	import PromoteButton from '#lib/components/admin/PromoteButton.svelte';
	import PromoteToasts from '#lib/components/admin/PromoteToasts.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import type { PageProps } from './$types';

	// Архивная страница — запасная: сюда попадаем, только если вернуть фильм на сайт не вышло
	// (+page.ts: оставлен в архиве, лимит, TMDB недоступен). Постер, название, год, бейдж «Архив»;
	// оценок, рецензий и списков нет. Закрыта от индексации. Админу — «Вернуть на сайт».
	let { data }: PageProps = $props();

	const doc = $derived(data.doc);
	const year = $derived(yearOf(doc.release_date));
	const original = $derived(originalTitle(doc));
	const isAdmin = $derived(session.user?.role === 'admin');
	let returned = $state(false);
	const promotions = new Promotions(() => (returned = true));
</script>

<Seo title="{doc.title}{year ? ` (${year})` : ''}" image={doc.cover_url} />
<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<section
	aria-label="Архивный фильм: {doc.title}"
	class="mb-12 grid items-start gap-6 sm:grid-cols-[12rem_1fr] md:grid-cols-[16rem_1fr] md:gap-10"
>
	<div class="w-40 opacity-80 sm:w-auto">
		<Poster
			title={doc.title}
			kind={doc.kind}
			coverUrl={doc.cover_url}
			alt="Постер: {doc.title}"
			eager
		/>
	</div>
	<div class="max-w-2xl min-w-0 md:pt-4">
		<span class="badge badge-neutral">Архив</span>
		<h1 class="mt-3 text-2xl leading-tight font-black tracking-tight text-balance sm:text-4xl">
			{doc.title}
		</h1>
		{#if original || year}
			<p class="mt-2 text-base-content/60">{[original, year].filter(Boolean).join(' · ')}</p>
		{/if}
		<p class="mt-6 text-sm text-base-content/60">
			Этого фильма пока нет на сайте: он в архиве, поэтому у него нет описания, оценок и рецензий.
		</p>
		{#if doc.tmdb_id}
			<p class="mt-2 text-sm">
				<a
					href={tmdbHref(doc.tmdb_id)}
					target="_blank"
					rel="noopener noreferrer"
					class="link link-primary">Страница на TMDB</a
				>
			</p>
		{/if}
		{#if returned}
			<div class="mt-6">
				<Alert kind="success">
					Фильм возвращён на сайт — <a href={entityHref(doc)} class="link">открыть карточку</a>.
				</Alert>
			</div>
		{:else if isAdmin}
			<div class="mt-6"><PromoteButton {doc} {promotions} /></div>
		{/if}
	</div>
</section>

<PromoteToasts {promotions} />
