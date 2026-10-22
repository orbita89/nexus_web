<script lang="ts">
	import { page } from '$app/state';
	import type { SchemaCollection, SchemaCollectionDetail } from '#lib/api/generated/social.ts';
	import { asKind, kindByApi, refHref } from '#lib/catalog/kinds.ts';
	import { count, yearOf } from '#lib/catalog/labels.ts';
	import {
		COLLECTION_LIMITS,
		collectionFormError,
		featuredBadge,
		isSaved,
		SAVES_SUPPORTED
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
	import FeaturedCollectionCard from '#lib/components/social/FeaturedCollectionCard.svelte';
	import ShareMenu from '#lib/components/social/ShareMenu.svelte';
	import CollectionComments from '#lib/components/social/CollectionComments.svelte';
	import SaveCollectionButton from '#lib/components/social/SaveCollectionButton.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import type { Snippet } from 'svelte';

	// Особая коллекция («Топ-10»): нумерованный рейтинг и полная SEO-разметка. Не зависит от
	// маршрута — при переезде на /top/{slug} переносится как есть.
	// actions — панель под шапкой (вне overflow-hidden, чтобы выпадающий поиск не обрезался).
	// editText — можно править название/описание (onsavetext), иначе кнопки нет.
	let {
		collection,
		others = [],
		actions,
		editText,
		onsavetext,
		headerModeOverride
	}: {
		collection: SchemaCollectionDetail;
		others?: SchemaCollection[];
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
	// Затухание низа текста — только если текст правда не влез (иначе гасится последняя строка зря).
	const fadeIfOverflow = (el: HTMLElement) => {
		const check = () => el.toggleAttribute('data-overflow', el.scrollHeight > el.clientHeight + 1);
		const ro = new ResizeObserver(check);
		ro.observe(el);
		return () => ro.disconnect();
	};
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
			class="btn btn-ghost btn-xs"
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
	<!-- Одна строка: акцентная линия, ★ и название (h1) на одном уровне с «N произведений · дата». -->
	<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
		<span class="h-px w-6 shrink-0 bg-(--page-accent)" aria-hidden="true"></span>
		<h1 class="flex items-baseline gap-2 text-base leading-snug font-semibold sm:text-lg">
			<span
				class="shrink-0 text-sm text-(--page-accent)"
				role="img"
				aria-label={featuredBadge(shownTitle)}
				title={featuredBadge(shownTitle)}>★</span
			>
			<span>{shownTitle}</span>
		</h1>
		<span class="text-xs tracking-wider text-base-content/60 uppercase">
			· {count(collection.items_count, ['произведение', 'произведения', 'произведений'])} ·
			<time datetime={collection.updated_at}>{reviewDate(collection.updated_at)}</time>
		</span>
		<ShareMenu url={canonical} title={shownTitle} compact />
		{#if SAVES_SUPPORTED}
			<SaveCollectionButton id={collection.id} saved={isSaved(collection)} />
		{/if}
		{@render editButton()}
	</div>
	{#if editing}
		{@render textForm()}
	{:else if shownDescription}
		<p class="mt-4 max-w-2xl leading-relaxed whitespace-pre-line text-base-content/70">
			{shownDescription}
		</p>
	{/if}
	{#if textError && !editing}<p class="mt-2 text-sm text-error" role="alert">{textError}</p>{/if}
{/snippet}

{#snippet textForm()}
	<form class="mt-4 flex max-w-2xl flex-col gap-2" onsubmit={saveText}>
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
	<!-- Шапка, панель и список — в одной колонке max-w-4xl: левый край заголовка совпадает со списком
	     (на широком экране подложка шапки выступает за колонку на свой отступ). -->
	<div class="mx-auto max-w-4xl">
		{#if hmode === 'none'}
			<!-- Без шапки: только заголовок, описание и мета (SSR, h1 = название). -->
			<div class="mb-6">
				{@render heading()}
			</div>
		{:else}
			<header
				class={[
					'relative isolate mb-6 overflow-hidden rounded-box p-6 sm:p-10 xl:-mx-10',
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
							class="absolute inset-y-0 right-0 -z-20 hidden w-1/2 grid-cols-4 gap-2 p-4 opacity-25 sm:grid"
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
		<!-- Панель автора/админа одной компактной строкой на тёмной подложке, не «плавает» над обоями. -->
		<div
			class={[
				'relative z-30 mb-10',
				editText &&
					'rounded-box bg-base-100/85 px-4 pb-4 ring-1 ring-base-content/10 backdrop-blur-md xl:-mx-10 xl:px-10'
			]}
		>
			{@render actions?.()}
		</div>
	</div>

	{#if items.length}
		<!-- Строка: номер | постер | текст. На телефоне сверху название и год, ниже крупный постер (растёт вместе с шириной экрана), под ним заметка и описание на всю
		     ширину, описание — по кнопке «Описание»; заметка видна всегда. На обоях текст с тенью, без подложки. -->
		<div class="relative">
			{#if hasWallpaper}
				<!-- Затемнение под колонкой списка: обои видны по краям, за текстом фон спокойнее. -->
				<div
					class="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-[min(100%,72rem)] -translate-x-1/2 bg-linear-to-r from-transparent via-base-100/70 to-transparent"
					aria-hidden="true"
				></div>
			{/if}
			<ol
				class={['mx-auto max-w-4xl', hasWallpaper && 'over-wallpaper']}
				reversed
				aria-label="Рейтинг: от {total}-го места к первому"
			>
				{#each items as { item, rank, kind, href }, i (item.entity.id)}
					{@const year = yearOf(item.entity.release_date)}
					{@const kindLabel = kind ? kindByApi(kind)?.one : null}
					{@const about = entityDescription(item.entity.overview)}
					<li
						value={rank}
						class="grid grid-cols-[auto_auto_minmax(0,1fr)] content-start gap-x-4 border-t border-base-content/10 py-6 first:border-t-0 first:pt-0 sm:gap-x-6 sm:py-10"
					>
						<!-- Номер — главный элемент топа: крупная тонкая цифра по верху постера (на компьютере).
						     На телефоне — лента карточек: постер во всю ширину с номером поверх, текст под ним
						     от той же левой линии. -->
						<span
							class={[
								'hidden w-9 text-right text-4xl leading-[0.8] font-light tracking-tighter tabular-nums sm:col-start-1 sm:row-[1/span_2] sm:row-start-1 sm:block sm:w-20 sm:text-7xl',
								rank <= 3 ? 'text-(--page-accent)' : 'text-base-content/65'
							]}
							aria-hidden="true">{rank}</span
						>
						<!-- Постер кликабелен (как название), тонкая светлая рамка отделяет его от тёмного фона. -->
						<a
							href={href ?? undefined}
							tabindex="-1"
							aria-hidden="true"
							class="group relative col-span-3 col-start-1 row-start-1 block aspect-[2/3] max-h-[70vh] w-full overflow-hidden rounded-box shadow-lg ring-1 ring-white/10 transition duration-300 hover:shadow-2xl hover:ring-(--page-accent)/60 sm:col-span-1 sm:col-start-2 sm:row-[1/span_2] sm:aspect-auto sm:max-h-none sm:w-[clamp(12rem,24vw,17rem)]"
						>
							{#if kind}
								<!-- На телефоне постер обрезается по высоте экрана, середина остаётся в кадре. -->
								<div
									class="absolute inset-x-0 top-1/2 -translate-y-1/2 transition-transform duration-300 group-hover:scale-[1.03] sm:static sm:translate-y-0"
								>
									<Poster
										title={item.entity.title}
										{kind}
										coverUrl={item.entity.cover_url}
										eager={i < 2}
									/>
								</div>
							{/if}
							<span
								class={[
									'absolute bottom-0 left-0 bg-linear-to-tr from-black/70 to-transparent px-4 pt-6 pb-3 text-6xl leading-none font-light tracking-tighter tabular-nums sm:hidden',
									rank <= 3 ? 'text-(--page-accent)' : 'text-white/90'
								]}
								aria-hidden="true">{rank}</span
							>
						</a>
						<!-- Текст не растягивает строку: на компьютере он ограничен высотой постера (лишнее
					     плавно скрывается), колонка ~65 символов; на телефоне название — до 2 строк, заметка — до 3. -->
						<div class="contents sm:relative sm:col-start-3 sm:row-[1/span_2] sm:block">
							<div class="contents sm:absolute sm:inset-0 sm:flex sm:flex-col">
								<div
									class="contents sm:flex sm:min-h-0 sm:shrink sm:flex-col sm:overflow-hidden data-overflow:sm:mask-[linear-gradient(to_bottom,#000_calc(100%-1.75rem),transparent)]"
									{@attach fadeIfOverflow}
								>
									<div class="col-span-3 col-start-1 row-start-2 max-sm:sr-only sm:block">
										<h2 class="line-clamp-2 text-lg leading-snug font-bold sm:text-2xl">
											<span class="sr-only">{rank} место. </span>
											{#if href}
												<a {href} class="link link-hover hover:text-(--page-accent)"
													>{item.entity.title}</a
												>
											{:else}
												{item.entity.title}
											{/if}
										</h2>
										{#if year || kindLabel}
											<p
												class="shrink-0 text-xs tracking-wider text-base-content/60 uppercase sm:mt-2"
											>
												{[year, kindLabel].filter(Boolean).join(' · ')}
											</p>
										{/if}
									</div>
									<div class="col-span-3 col-start-1 row-start-3 mt-4 min-w-0 empty:hidden">
										{#if item.note}
											<!-- Заметка — голос подборки: цитата с акцентной линией. -->
											<p
												class={[
													'border-l-2 border-(--page-accent) pl-4 text-[0.95rem] leading-relaxed font-medium whitespace-pre-line text-base-content'
												]}
											>
												{item.note}
											</p>
										{/if}
										{#if about}
											<p
												class={[
													'hidden text-sm leading-relaxed text-base-content/70 sm:block',
													item.note && 'mt-4'
												]}
											>
												{about}
											</p>
										{/if}
									</div>
								</div>
								{#if href}
									<a
										{href}
										class="hidden shrink-0 self-start pt-4 text-sm text-base-content/60 transition-colors hover:text-(--page-accent) sm:block"
										>Подробнее →</a
									>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ol>
		</div>
	{:else}
		<p class="mx-auto max-w-4xl text-base-content/60">В подборке пока ничего нет.</p>
	{/if}

	<!-- Конец страницы: поделиться и похожие подборки (обычные ссылки — перелинковка для SEO). -->
	<footer class="mx-auto mt-10 max-w-4xl border-t border-base-content/10 pt-10">
		<ShareMenu url={canonical} title={shownTitle} />
	</footer>
	<section class="mt-10" aria-labelledby={others.length ? `${uid}-others` : undefined}>
		<div class="mx-auto mb-6 flex max-w-4xl items-center justify-between gap-4">
			{#if others.length}
				<h2
					id="{uid}-others"
					class="flex items-center gap-2 text-xs tracking-wider text-base-content/60 uppercase"
				>
					<span class="h-px w-6 bg-(--page-accent)" aria-hidden="true"></span>
					Похожие подборки
				</h2>
			{/if}
			<a href="/collections/featured" class="ml-auto link text-xs link-hover">Все подборки →</a>
		</div>
		{#if others.length}
			<!-- Телефон: горизонтальная прокрутка карточек; шире — сетка. -->
			<ul
				class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
			>
				{#each others as other (other.id)}
					<li class="w-[80vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none">
						<FeaturedCollectionCard collection={other} />
					</li>
				{/each}
			</ul>
		{/if}
	</section>
	{#key collection.id}
		<CollectionComments
			collectionId={collection.id}
			ownerId={collection.owner.id}
			count={collection.comments_count}
			locked={collection.comments_locked}
		/>
	{/key}
</div>

<style>
	/* Текст поверх обоев: мягкая тёмная тень вместо подложки — читается на ярком фоне. */
	.over-wallpaper :global(h2),
	.over-wallpaper :global(p) {
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.7);
	}
</style>
