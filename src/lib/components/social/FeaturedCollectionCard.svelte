<script lang="ts">
	import type { SchemaCollection } from '#lib/api/generated/social.ts';
	import { buildFeaturedUrl } from '#lib/social/featured.ts';
	import { asKind } from '#lib/catalog/kinds.ts';
	import { count, summary } from '#lib/catalog/labels.ts';
	import { featuredBadge } from '#lib/social/collections.ts';
	import { normalizeAccent, resolveFeaturedLook } from '#lib/social/featuredThemes.ts';
	import Poster from '#lib/components/catalog/Poster.svelte';

	// Карточка особой коллекции (is_featured): крупнее обычной, акцентная рамка и фон, бейдж
	// «Подборка редакции» / «Топ», веер обложек из preview. Автор не выделяется — «Редакция».

	// Оформление: cover_url → тема → коллаж (src/lib/social/featuredThemes.ts).

	let { collection }: { collection: SchemaCollection } = $props();
	const look = $derived(resolveFeaturedLook(collection));
	// Свой акцент (accent_color) — бейдж и рамка; иначе цвета темы.
	const accent = $derived(normalizeAccent(collection.accent_color));
</script>

<article
	class="relative isolate flex h-full flex-col overflow-hidden rounded-box bg-linear-to-br p-5 ring-2 transition sm:p-6 {look
		.theme.gradient} {look.theme.ring}"
	style:--tw-ring-color={accent}
>
	{#if look.theme.pattern}
		<div
			class="pointer-events-none absolute inset-0 -z-10"
			style:background={look.theme.pattern}
			aria-hidden="true"
		></div>
	{/if}
	<div class="mb-3 flex items-center gap-2">
		<span
			class="text-lg leading-none text-warning"
			style:color={accent}
			role="img"
			aria-label={featuredBadge(collection.title)}
			title={featuredBadge(collection.title)}>★</span
		>
	</div>
	{#if look.kind === 'cover'}
		<a href={buildFeaturedUrl(collection)} class="mb-4 block" tabindex="-1" aria-hidden="true">
			<img
				src={look.url}
				alt=""
				loading="lazy"
				class="aspect-video w-full rounded-box object-cover"
			/>
		</a>
	{:else}
		<a
			href={buildFeaturedUrl(collection)}
			class="mb-4 grid grid-cols-4 gap-2"
			tabindex="-1"
			aria-hidden="true"
		>
			{#each { length: 4 }, i (i)}
				{@const entity = collection.preview[i]}
				{#if entity}
					<Poster
						title={entity.title}
						kind={asKind(entity.kind) ?? 'movie'}
						coverUrl={entity.cover_url}
					/>
				{:else}
					<div class="aspect-2/3 rounded-box bg-base-100/40"></div>
				{/if}
			{/each}
		</a>
	{/if}
	<h3 class="text-xl leading-snug font-black sm:text-2xl">
		<a href={buildFeaturedUrl(collection)} class="hover:text-primary">{collection.title}</a>
	</h3>
	{#if collection.description}
		<p class="mt-1.5 line-clamp-3 text-sm text-base-content/70">
			{summary(collection.description, 200)}
		</p>
	{/if}
	<p class="mt-auto pt-3 text-xs text-base-content/60">
		{count(collection.items_count, ['произведение', 'произведения', 'произведений'])} · Редакция
	</p>
</article>
