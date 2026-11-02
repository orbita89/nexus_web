<script lang="ts">
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { kindByApi } from '#lib/catalog/kinds.ts';

	let {
		title,
		kind,
		coverUrl,
		alt = '',
		eager = false,
		small = false
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
	} = $props();

	let failed = $state(false);
	const showImage = $derived(!!coverUrl && !failed);
	/**
	 * Картину нельзя кадрировать: «Ночной дозор» в пропорциях постера — уже не «Ночной дозор».
	 * Поэтому у картин квадратная плитка, как в ленте: холст целиком в своих пропорциях, а пустоту
	 * вокруг заполняет размытая копия его самого — ни обрезки, ни чёрных полей.
	 */
	const art = $derived(kind === 'painting');
</script>

<div
	class={[
		'relative w-full overflow-hidden rounded-box',
		art
			? 'flex aspect-square items-center justify-center bg-base-300 ring-1 ring-base-content/5'
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
			loading={eager ? 'eager' : 'lazy'}
			decoding="async"
			class="relative max-h-[86%] max-w-[86%] rounded-[2px] object-contain shadow-[0_8px_24px_-6px_rgba(0,0,0,0.85)] ring-1 ring-black/50"
			onerror={() => (failed = true)}
		/>
	{:else if showImage}
		<img
			src={coverUrl}
			{alt}
			loading={eager ? 'eager' : 'lazy'}
			decoding="async"
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
				<span class="line-clamp-5 text-base leading-tight font-bold text-base-content/90">
					{title}
				</span>
			{/if}
		</div>
	{/if}
</div>
