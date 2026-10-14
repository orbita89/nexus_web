<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import { aboutRows, aboutTitle, creditGroups, originalTitle } from '#lib/catalog/card.ts';
	import Clamp from '#lib/components/catalog/Clamp.svelte';
	import Credits from './Credits.svelte';

	// «О фильме» — две плашки. Первая — одна таблица с подписями, как у Кинопоиска: оригинальное
	// название, описание (в шапке их нет), год, страна, съёмочная группа (по трое в строке),
	// премьера, длительность. Вторая, отдельно: полные титры с фото по группам (Credits). Справа
	// от таблицы — aside (страница кладёт туда «Производство и факты»). Хронология — отдельно и
	// только когда она есть.
	let { entity, aside }: { entity: SchemaEntityDetail; aside?: Snippet } = $props();

	const rows = $derived(aboutRows(entity));
	const groups = $derived(creditGroups(entity.credits));
	const title = $derived(aboutTitle(entity.kind));
	const original = $derived(originalTitle(entity));
</script>

<section id="about" aria-labelledby="about-title" class="mb-14 scroll-mt-32 md:scroll-mt-20">
	<h2 id="about-title" class="mb-4 text-2xl font-bold">{title}</h2>

	<div class="flex flex-col gap-4">
		<!-- Плашка 1 и справа от неё (с lg) боковая колонка aside — «Производство и факты». -->
		<div class={['grid gap-4', aside && 'lg:grid-cols-[minmax(0,1fr)_20rem]']}>
			<!-- Плашка 1: одна таблица — оригинальное название, описание и факты, все строки с подписью. -->
			{#if original || entity.description || rows.length}
				<dl
					class="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-box bg-base-200 p-5 text-sm ring-1 ring-base-content/5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:p-7"
				>
					{#if original}
						<dt class="text-base-content/50">Оригинальное название</dt>
						<dd class="font-medium">{original}</dd>
					{/if}
					{#if entity.description}
						<dt class="text-base-content/50">Описание</dt>
						<dd class="max-w-3xl">
							<Clamp lines={4} class="leading-relaxed text-base-content/90">
								<p class="whitespace-pre-line">{entity.description}</p>
							</Clamp>
						</dd>
					{/if}
					{#each rows as row (row.label)}
						<dt class="text-base-content/50">{row.label}</dt>
						<dd>
							{#if row.links}
								{#each row.links as link, i (link.href)}{i ? ', ' : ''}<a
										href={link.href}
										class="font-medium decoration-primary/40 underline-offset-4 hover:text-primary hover:underline"
										>{link.text}</a
									>{/each}{#if row.more}<a
										href="#credits"
										class="text-base-content/50 hover:text-primary hover:underline"
									>
										и ещё {row.more}</a
									>{/if}
							{:else}
								{row.text}
							{/if}
						</dd>
					{/each}
				</dl>
			{/if}
			{@render aside?.()}
		</div>

		<!-- Плашка 2, отдельно: полные титры по группам. Нет титров — нет и плашки. -->
		{#if groups.length}<Credits {groups} />{/if}
	</div>
</section>
