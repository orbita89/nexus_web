<script lang="ts">
	import { navigating } from '$app/state';
	import type { SchemaArchiveDoc } from '#lib/api/generated/catalog.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import Poster from './Poster.svelte';

	// Фильм из архива в общей выдаче: выглядит как обычная карточка, только с надписью «Архив».
	// Клик — /archive/{slug}: бэкенд возвращает фильм на сайт с данными TMDB, и открывается его
	// карточка; пока идёт возврат — «Открываем…». Без предзагрузки по наведению (её load и есть
	// возврат) и nofollow: фильм возвращает только клик человека.
	let { doc }: { doc: SchemaArchiveDoc } = $props();

	const href = $derived(`/archive/${doc.slug}`);
	const opening = $derived(navigating.to?.url.pathname === href);
</script>

<a
	{href}
	rel="nofollow"
	data-sveltekit-preload-data="off"
	class="group relative block rounded-box outline-offset-4"
	aria-busy={opening}
>
	<div
		class="rounded-box transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-2 group-hover:shadow-primary/20 group-hover:ring-primary group-focus-visible:ring-2 group-focus-visible:ring-primary"
	>
		<Poster title={doc.title} kind={doc.kind} coverUrl={doc.cover_url} />
	</div>
	<div class="mt-2 px-0.5">
		<h3
			class="line-clamp-2 text-sm leading-snug font-semibold transition-colors group-hover:text-primary"
		>
			{doc.title}
		</h3>
		<p class="mt-0.5 text-xs text-base-content/50">
			{[yearOf(doc.release_date), 'Архив'].filter(Boolean).join(' · ')}
		</p>
	</div>
	{#if opening}
		<span
			class="absolute inset-x-0 top-0 flex aspect-2/3 flex-col items-center justify-center gap-2 rounded-box bg-base-100/70 text-sm font-medium"
			role="status"
		>
			<span class="loading loading-md loading-spinner text-primary"></span>
			Открываем…
		</span>
	{/if}
</a>
