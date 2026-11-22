<script lang="ts">
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { kindByApi } from '#lib/catalog/kinds.ts';

	let {
		title,
		kind,
		coverUrl,
		alt = '',
		eager = false,
		small = false,
		note,
		width,
		height
	}: {
		title: string;
		kind: SchemaEntityKind;
		coverUrl?: string | null;
		/** Пусто, если название и так написано рядом (карточка в сетке). */
		alt?: string;
		/** Постер над сгибом (карточка сущности) — грузить сразу. */
		eager?: boolean;
		/** Миниатюра (списки): в заглушке вместо названия — первая буква. */
		small?: boolean;
		/** Строка под названием в заглушке: автор книги (обложки нет у каждой пятой). */
		note?: string;
		/** Размеры файла обложки (`cover_width`/`cover_height`): браузер знает пропорции до загрузки. */
		width?: number | null;
		height?: number | null;
	} = $props();

	/**
	 * Атрибуты загрузки. Обложка над сгибом — главная картинка страницы (LCP): качаем сразу и
	 * первой (`fetchpriority="high"`, без lazy). Остальные — лениво, у экрана. Место под картинку
	 * держит плитка с aspect-ratio, а width/height дают браузеру пропорции заранее (CLS = 0).
	 */
	const load = $derived({
		loading: eager ? ('eager' as const) : ('lazy' as const),
		fetchpriority: eager ? ('high' as const) : undefined,
		decoding: eager ? undefined : ('async' as const),
		width: width ?? undefined,
		height: height ?? undefined
	});

	let failed = $state(false);
	const showImage = $derived(!!coverUrl && !failed);
	/**
	 * Картину нельзя кадрировать: «Ночной дозор» в пропорциях постера — уже не «Ночной дозор».
	 * Поэтому у картин квадратная плитка, как в ленте: холст целиком в своих пропорциях, а пустоту
	 * вокруг заполняет размытая копия его самого — ни обрезки, ни чёрных полей.
	 *
	 * У игр обложки тоже не постерные: квадратные иконки, широкие ключ-арты, логотипы на пустом
	 * фоне. В 2:3 они обрезались до неузнаваемости, поэтому тот же приём, но в 3:4 — ближе к
	 * привычной коробке.
	 */
	const art = $derived(kind === 'painting' || kind === 'game');
</script>

<div
	class={[
		'relative w-full overflow-hidden rounded-box',
		art
			? [
					'flex items-center justify-center bg-base-300 ring-1 ring-base-content/5',
					kind === 'game' ? 'aspect-3/4' : 'aspect-square'
				]
			: 'aspect-2/3 bg-base-300 shadow-md ring-1 ring-base-content/5'
	]}
>
	{#if showImage && art}
		<!-- Фон плитки: та же картина, увеличенная и размытая. Декоративная — вне доступности. -->
		<img
			src={coverUrl}
			alt=""
			aria-hidden="true"
			loading={eager ? 'eager' : 'lazy'}
			decoding="async"
			class="absolute inset-0 h-full w-full scale-125 object-cover opacity-45 blur-xl saturate-150"
		/>
		<!-- Размер по самому холсту (max-* + w/h auto), поэтому рама облегает картину, а не ячейку. -->
		<img
			src={coverUrl}
			{alt}
			{...load}
			class="relative max-h-[86%] max-w-[86%] rounded-[2px] object-contain shadow-[0_8px_24px_-6px_rgba(0,0,0,0.85)] ring-1 ring-black/50"
			onerror={() => (failed = true)}
		/>
	{:else if showImage}
		<img
			src={coverUrl}
			{alt}
			{...load}
			class="h-full w-full object-cover"
			onerror={() => (failed = true)}
		/>
	{:else}
		<!-- Заглушка вместо обложки: как корешок — тип сверху, название снизу. -->
		<div
			class={[
				'flex h-full w-full flex-col justify-between bg-linear-to-br via-base-300 to-base-200 p-3',
				{
					'from-primary/35': kind === 'movie',
					'from-secondary/35': kind === 'series',
					'from-accent/30': kind === 'book',
					'from-info/30': kind === 'game',
					'from-warning/25': kind === 'painting'
				}
			]}
			role={alt ? 'img' : undefined}
			aria-label={alt || undefined}
			aria-hidden={alt ? undefined : 'true'}
		>
			{#if small}
				<span class="m-auto text-xl font-black text-base-content/70">{title.slice(0, 1)}</span>
			{:else}
				<span class="text-[0.65rem] font-semibold tracking-widest text-base-content/50 uppercase">
					{kindByApi(kind).one}
				</span>
				<span class="min-w-0">
					<span class="line-clamp-5 text-base leading-tight font-bold text-base-content/90">
						{title}
					</span>
					{#if note}
						<span class="mt-1 line-clamp-2 block text-xs leading-snug text-base-content/60">
							{note}
						</span>
					{/if}
				</span>
			{/if}
		</div>
	{/if}
</div>
