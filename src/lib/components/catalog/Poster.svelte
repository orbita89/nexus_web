<script lang="ts">
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import { kindByApi } from '#lib/catalog/kinds.ts';

	let {
		title,
		kind,
		coverUrl,
		alt = '',
		eager = false
	}: {
		title: string;
		kind: SchemaEntityKind;
		coverUrl?: string | null;
		/** Пусто, если название и так написано рядом (карточка в сетке). */
		alt?: string;
		/** Постер над сгибом (карточка сущности) — грузить сразу. */
		eager?: boolean;
	} = $props();

	let failed = $state(false);
	const showImage = $derived(!!coverUrl && !failed);
</script>

<div
	class="relative aspect-2/3 w-full overflow-hidden rounded-box bg-base-300 shadow-md ring-1 ring-base-content/5"
>
	{#if showImage}
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
					'from-info/30': kind === 'game'
				}
			]}
			role={alt ? 'img' : undefined}
			aria-label={alt || undefined}
			aria-hidden={alt ? undefined : 'true'}
		>
			<span class="text-[0.65rem] font-semibold tracking-widest text-base-content/50 uppercase">
				{kindByApi(kind).one}
			</span>
			<span class="line-clamp-5 text-base leading-tight font-bold text-base-content/90">
				{title}
			</span>
		</div>
	{/if}
</div>
