<script lang="ts">
	import TimeAgo from '#lib/components/social/TimeAgo.svelte';
	import { asKind, entityHref, KINDS } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import { journalActionLabel, type JournalItem } from '#lib/social/journal.ts';

	// Одна запись журнала. Слева — постер и название с «год · тип», справа — дата последней
	// активности и переход к карточке. Рецензия — отрывком с «Развернуть» (спойлер — за кнопкой),
	// заметка — в <details>; заметка и отметка приходят только владельцу.
	let { item }: { item: JournalItem } = $props();

	const entity = $derived(item.entity);
	const kind = $derived(asKind(entity.kind));
	const href = $derived(kind ? entityHref({ kind, slug: entity.slug }) : null);
	const kindTitle = $derived(KINDS.find((k) => k.kind === entity.kind)?.one ?? null);
	const year = $derived(yearOf(entity.release_date));
	const meta = $derived([year, kindTitle].filter(Boolean).join(' · '));

	let spoilerOpen = $state(false);
	let expanded = $state(false);
	const review = $derived(item.review);
	const hidden = $derived(!!review?.is_spoiler && !spoilerOpen);
</script>

<li class="flex gap-3 rounded-box bg-base-200 p-3 ring-1 ring-base-300 sm:gap-4 sm:p-4">
	<div
		class="flex aspect-[2/3] w-16 shrink-0 items-center self-start justify-center overflow-hidden rounded-field bg-base-300"
	>
		{#if entity.cover_url}
			<img src={entity.cover_url} alt="" loading="lazy" class="size-full max-w-full object-cover" />
		{:else}
			<span class="text-lg font-black text-base-content/30" aria-hidden="true"
				>{entity.title.slice(0, 1)}</span
			>
		{/if}
	</div>
	<div class="min-w-0 flex-1">
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0">
				{#if href}
					<a {href} class="font-semibold hover:text-primary">{entity.title}</a>
				{:else}
					<span class="font-semibold">{entity.title}</span>
				{/if}
				{#if meta}
					<p class="text-sm text-base-content/50">{meta}</p>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-2 text-xs text-base-content/50">
				<TimeAgo iso={item.last_activity_at} />
				{#if href}
					<a
						{href}
						class="btn btn-ghost btn-square btn-xs text-base-content/60"
						aria-label="Открыть карточку"
						title="Открыть карточку">↗</a
					>
				{/if}
			</div>
		</div>

		<ul class="mt-2 flex flex-wrap gap-1.5" aria-label="Что сделано">
			{#each item.actions as action (action)}
				{@const label = journalActionLabel(action)}
				<li class="badge badge-outline badge-sm gap-1">
					<span aria-hidden="true">{label.icon}</span>
					{action === 'rating' && item.rating ? `${label.title} ${item.rating}` : label.title}
				</li>
			{/each}
		</ul>

		{#if review}
			<div class="mt-3 text-sm text-base-content/80">
				{#if hidden}
					<button class="btn btn-xs" onclick={() => (spoilerOpen = true)}>
						Рецензия со спойлерами — показать
					</button>
				{:else}
					<p class="whitespace-pre-line">{expanded ? review.body : review.excerpt}</p>
					{#if review.body.length > review.excerpt.length}
						<button class="link text-xs link-primary" onclick={() => (expanded = !expanded)}>
							{expanded ? 'Свернуть' : 'Развернуть'}
						</button>
					{/if}
				{/if}
			</div>
		{/if}

		{#if item.note}
			<details class="mt-2 text-sm">
				<summary class="cursor-pointer text-base-content/60">Заметка</summary>
				<p class="mt-1 whitespace-pre-line text-base-content/80">{item.note.body}</p>
			</details>
		{/if}
	</div>
</li>
