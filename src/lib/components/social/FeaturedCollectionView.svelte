<script lang="ts">
	import { page } from '$app/state';
	import type { SchemaCollectionDetail } from '#lib/api/generated/social.ts';
	import { asKind, kindByApi, refHref } from '#lib/catalog/kinds.ts';
	import { count, yearOf } from '#lib/catalog/labels.ts';
	import {
		COLLECTION_LIMITS,
		collectionFormError,
		featuredBadge
	} from '#lib/social/collections.ts';
	import {
		buildFeaturedUrl,
		featuredDescription,
		featuredJsonLd,
		featuredTitle,
		jsonLdScript
	} from '#lib/social/featured.ts';
	import {
		collectionCoverUrl,
		collectionThemeId,
		collectionWallpaperUrl,
		headerMode,
		pageAccent,
		resolveFeaturedHero,
		resolvePageStyle
	} from '#lib/social/featuredThemes.ts';
	import { reviewDate } from '#lib/social/reviews.ts';
	import CollectionBackdrop from '#lib/components/social/CollectionBackdrop.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import type { Snippet } from 'svelte';

	// Особая коллекция («Топ-10»): нумерованный рейтинг и полная SEO-разметка. Не зависит от
	// маршрута — при переезде на /top/{slug} переносится как есть.
	// actions — панель под шапкой (вне overflow-hidden, чтобы выпадающий поиск не обрезался).
	// editText — можно править название/описание (onsavetext), иначе кнопки нет.
	let {
		collection,
		actions,
		editText,
		onsavetext,
		headerModeOverride
	}: {
		collection: SchemaCollectionDetail;
		actions?: Snippet;
		editText?: boolean;
		onsavetext?: (form: { title: string; description: string }) => Promise<string | null>;
		headerModeOverride?: 'styled' | 'plain' | 'none';
	} = $props();

	// Оптимистичная правка: показываем новое сразу, при ошибке откатываем.
	let optimistic = $state<{ title: string; description: string | null } | null>(null);
	const shownTitle = $derived(optimistic?.title ?? collection.title);
	const shownDescription = $derived(optimistic ? optimistic.description : collection.description);
	let editing = $state(false);
	let draftTitle = $state('');
	let draftDescription = $state('');
	let textError = $state('');
	let saving = $state(false);
	const uid = $props.id();

	function startEdit() {
		draftTitle = shownTitle;
		draftDescription = shownDescription ?? '';
		textError = '';
		editing = true;
	}

	async function saveText(event: SubmitEvent) {
		event.preventDefault();
		const form = { title: draftTitle, description: draftDescription };
		const local = collectionFormError(form);
		if (local) {
			textError = local;
			return;
		}
		saving = true;
		textError = '';
		optimistic = { title: form.title.trim(), description: form.description.trim() || null };
		editing = false;
		const err = (await onsavetext?.(form)) ?? null;
		saving = false;
		if (err) {
			optimistic = null;
			textError = err;
			editing = true;
		}
	}

	// Новые данные с сервера — оптимистичное значение больше не нужно.
	$effect(() => {
		void collection.title;
		void collection.description;
		if (!saving) optimistic = null;
	});

	const origin = $derived(page.url.origin);
	const canonical = $derived(origin + buildFeaturedUrl(collection));
	const title = $derived(`${featuredTitle(collection)} | Nexus`);
	const description = $derived(featuredDescription(collection));
	const look = $derived(resolveFeaturedHero(collection));
	// Оформление страницы: обои шапкой или фоном, затемнение/размытие, эффекты, свой акцент.
	const style = $derived(resolvePageStyle(collection));
	// Шапка: тематическая, нейтральная (без темы/обоев, страница — по-прежнему с обоями) или без шапки.
	const hmode = $derived(headerModeOverride ?? headerMode(collection));
	const accent = $derived(pageAccent(collection));
	const hasWallpaper = $derived(!!collectionWallpaperUrl(collection));
	// Раскрытые описания по id сущности (на телефоне описание скрыто до клика).
	let expanded = $state<Record<string, boolean>>({});
	// При mode 'page' обои уже фоном страницы — в шапке их не дублируем.
	const headerWallpaper = $derived(
		hmode === 'styled' && look.kind === 'cover' && style.mode === 'header'
	);
	// og:image: обложка → обои → обложка первого произведения.
	const image = $derived(
		collectionCoverUrl(collection) ??
			collectionWallpaperUrl(collection) ??
			collection.items.find((i) => i.entity.cover_url)?.entity.cover_url ??
			null
	);
	const ld = $derived(jsonLdScript(featuredJsonLd(collection, origin)));
	// Обратный отсчёт: сверху худшее место (#N), внизу — #1. items приходят по месту (1 — лучший).
	const total = $derived(collection.items.length);
	const items = $derived(
		collection.items
			.map((item, i) => ({
				item,
				rank: i + 1,
				kind: asKind(item.entity.kind),
				href: refHref(item.entity)
			}))
			.reverse()
	);
	// Описание произведения: бэкенд отдаёт чистый текст до 1000 символов (уже обрезан).
	const entityDescription = (overview: string | null | undefined): string | null =>
		overview?.trim() || null;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Nexus" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	{#if image}<meta property="og:image" content={image} />{/if}
	<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{#if image}<meta name="twitter:image" content={image} />{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON экранирован в jsonLdScript -->
	{@html ld}
</svelte:head>

{#snippet editButton()}
	{#if editText && !editing}
		<button
			type="button"
			class="btn mt-1 btn-ghost btn-xs"
			disabled={saving}
			title="Изменить название и описание"
			aria-label="Изменить название и описание"
			onclick={startEdit}
		>
			✎ Изменить
		</button>
	{/if}
{/snippet}

{#snippet heading()}
	<div class="flex flex-wrap items-start gap-x-2">
		<h1 class="flex items-start gap-2 text-3xl font-black sm:text-4xl">
			<span
				class="mt-1 shrink-0 text-2xl text-warning sm:text-3xl"
				style:color={style.accent}
				role="img"
				aria-label={featuredBadge(shownTitle)}
				title={featuredBadge(shownTitle)}>★</span
			>
			<span>{shownTitle}</span>
		</h1>
		{@render editButton()}
	</div>
	{#if editing}
		{@render textForm()}
	{:else if shownDescription}
		<p class="mt-2 max-w-2xl whitespace-pre-line text-base-content/70">
			{shownDescription}
		</p>
	{/if}
	{#if textError && !editing}<p class="mt-2 text-sm text-error" role="alert">{textError}</p>{/if}
	<p class="mt-4 text-sm text-base-content/60">
		{count(collection.items_count, ['произведение', 'произведения', 'произведений'])}
	</p>
	<p class="mt-2 text-right text-xs text-base-content/45">
		обновлена {reviewDate(collection.updated_at)}
	</p>
{/snippet}

{#snippet textForm()}
	<form class="mt-3 flex max-w-2xl flex-col gap-2" onsubmit={saveText}>
		<label class="form-control">
			<span class="label-text text-xs">Название</span>
			<input
				class="input-bordered input w-full input-sm"
				required
				maxlength={COLLECTION_LIMITS.title}
				bind:value={draftTitle}
				aria-describedby="{uid}-err"
			/>
		</label>
		<label class="form-control">
			<span class="label-text text-xs">Описание</span>
			<textarea
				class="textarea-bordered textarea w-full textarea-sm"
				rows="3"
				maxlength={COLLECTION_LIMITS.description}
				bind:value={draftDescription}></textarea>
		</label>
		<div class="flex items-center gap-2">
			<button type="submit" class="btn btn-primary btn-sm" disabled={saving}>Сохранить</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (editing = false)}
				>Отмена</button
			>
			<span id="{uid}-err" class="text-sm text-error" role="alert">{textError}</span>
		</div>
	</form>
{/snippet}

<CollectionBackdrop
	themeId={collectionThemeId(collection)}
	wallpaperUrl={collectionWallpaperUrl(collection)}
	mode={style.mode}
	dim={style.dim}
	blur={style.blur}
	effects={style.effects}
	accent={style.accent}
/>
<div class="relative z-10" style:--page-accent={accent}>
	{#if hmode === 'none'}
		<!-- Без шапки: только заголовок, описание и мета (SSR, h1 = название). -->
		<div class="mb-2">
			{@render heading()}
		</div>
	{:else}
		<header
			class={[
				'relative isolate overflow-hidden rounded-box p-5 sm:p-8',
				hmode === 'plain'
					? 'bg-base-100/85 ring-1 ring-base-content/10 backdrop-blur-sm'
					: look.kind === 'cover' && style.mode === 'page'
						? 'bg-base-100/40 backdrop-blur-sm'
						: ['bg-linear-to-br', look.theme.gradient]
			]}
		>
			{#if hmode === 'styled'}
				{#if headerWallpaper && look.kind === 'cover'}
					<img
						src={look.url}
						alt=""
						class="absolute inset-0 -z-30 h-full w-full object-cover"
						class:scale-105={style.blur > 0}
						style:filter={style.blur ? `blur(${style.blur}px)` : null}
						fetchpriority="high"
					/>
					<div
						class="absolute inset-0 -z-20 bg-base-100"
						style:opacity={(style.dim / 100) * 0.6}
						aria-hidden="true"
					></div>
					<!-- Затемнение слева направо и снизу: текст читается на любых обоях. -->
					<div
						class="absolute inset-0 -z-20 bg-linear-to-r from-base-100 via-base-100/80 to-base-100/20"
						aria-hidden="true"
					></div>
					<div
						class="absolute inset-0 -z-20 bg-linear-to-t from-base-100/70 to-transparent"
						aria-hidden="true"
					></div>
				{:else if look.kind === 'collage'}
					<div
						class="absolute inset-y-0 right-0 -z-20 hidden w-1/2 grid-cols-4 gap-2 p-3 opacity-25 sm:grid"
						aria-hidden="true"
					>
						{#each collection.items.slice(0, 4) as item (item.entity.id)}
							{#if item.entity.cover_url}
								<img
									src={item.entity.cover_url}
									alt=""
									class="h-full w-full rounded-box object-cover"
								/>
							{/if}
						{/each}
					</div>
				{/if}
				{#if look.theme.pattern && style.effects}
					<div
						class="pointer-events-none absolute inset-0 -z-10"
						style:background={look.theme.pattern}
						aria-hidden="true"
					></div>
				{/if}
			{/if}
			{@render heading()}
		</header>
	{/if}
	<div class="relative z-30 mb-8">{@render actions?.()}</div>

	{#if items.length}
		<!-- Строка: номер | постер | текст. На телефоне сверху название и год, ниже крупный постер (растёт вместе с шириной экрана), под ним заметка и описание на всю
		     ширину, описание — по кнопке «Описание»; заметка видна всегда. На обоях текст с тенью, без подложки. -->
		<ol
			class={['mx-auto max-w-4xl', hasWallpaper && 'over-wallpaper']}
			reversed
			aria-label="Рейтинг: от {total}-го места к первому"
		>
			{#each items as { item, rank, kind, href }, i (item.entity.id)}
				{@const year = yearOf(item.entity.release_date)}
				{@const kindLabel = kind ? kindByApi(kind)?.one : null}
				{@const about = entityDescription(item.entity.overview)}
				{@const open = expanded[item.entity.id] ?? false}
				<li
					value={rank}
					class="grid grid-cols-[auto_auto_minmax(0,1fr)] content-start gap-x-3 border-t border-base-content/10 py-8 first:border-t-0 first:pt-0 sm:gap-x-6 sm:py-10"
				>
					<span
						class={[
							'col-start-1 row-start-1 w-6 pt-0.5 text-right text-xl leading-none font-semibold tabular-nums sm:row-span-2 sm:w-10 sm:text-3xl',
							rank <= 3 ? 'text-(--page-accent)' : 'text-base-content/50'
						]}
						aria-hidden="true">{rank}</span
					>
					<div
						class="col-span-2 col-start-2 row-start-2 mt-3 w-[clamp(13rem,62vw,18rem)] overflow-hidden rounded-box shadow-lg sm:col-span-1 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-[clamp(12rem,24vw,17rem)]"
					>
						{#if kind}
							<Poster
								title={item.entity.title}
								{kind}
								coverUrl={item.entity.cover_url}
								eager={i < 2}
							/>
						{/if}
					</div>
					<div class="col-span-2 col-start-2 row-start-1 min-w-0 sm:col-span-1 sm:col-start-3">
						<h2 class="text-lg leading-snug font-bold sm:text-xl">
							<span class="sr-only">{rank} место. </span>
							{#if href}
								<a {href} class="link link-hover hover:text-(--page-accent)">{item.entity.title}</a>
							{:else}
								{item.entity.title}
							{/if}
						</h2>
						{#if year || kindLabel}
							<p class="mt-1 text-sm text-base-content/75">
								{[year, kindLabel].filter(Boolean).join(' · ')}
							</p>
						{/if}
					</div>
					{#if item.note || about}
						<div
							class="col-span-2 col-start-2 row-start-3 mt-4 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-2 sm:mt-3"
						>
							{#if item.note}
								<p
									class="text-sm leading-relaxed font-semibold whitespace-pre-line text-base-content sm:text-base"
								>
									{item.note}
								</p>
							{/if}
							{#if about}
								<p
									class={[
										'text-sm leading-relaxed font-medium text-base-content/90 sm:text-base',
										item.note && 'mt-3',
										!open && 'hidden sm:block'
									]}
								>
									{about}
								</p>
								<button
									type="button"
									class={[
										'text-sm font-medium text-(--page-accent) hover:underline sm:hidden',
										(item.note || open) && 'mt-2'
									]}
									aria-expanded={open}
									onclick={() => (expanded[item.entity.id] = !open)}
								>
									{open ? 'Скрыть описание' : 'Описание'}
								</button>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{:else}
		<p class="text-base-content/60">В подборке пока ничего нет.</p>
	{/if}
</div>

<style>
	/* Текст поверх обоев: мягкая тёмная тень вместо подложки — читается на ярком фоне. */
	.over-wallpaper :global(h2),
	.over-wallpaper :global(p) {
		text-shadow:
			0 1px 2px rgb(0 0 0 / 0.95),
			0 0 10px rgb(0 0 0 / 0.75),
			0 0 22px rgb(0 0 0 / 0.5);
	}
</style>
