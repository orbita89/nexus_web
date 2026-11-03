<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import { aboutRows, aboutTitle, creditGroups, originalTitle } from '#lib/catalog/card.ts';
	import Clamp from '#lib/components/catalog/Clamp.svelte';
	import Credits from './Credits.svelte';

	// «О фильме» — две плашки. Первая: описание текстом, под ним факты парами подпись/значение
	// (оригинальное название, год, страна, съёмочная группа по трое в строке, премьера,
	// длительность). Вторая, отдельно: полные титры с фото по группам (Credits). Справа
	// от таблицы — aside (страница кладёт туда «Производство и факты»). Хронология — отдельно и
	// только когда она есть.
	let { entity, aside }: { entity: SchemaEntityDetail; aside?: Snippet } = $props();

	const rows = $derived(aboutRows(entity));
	const groups = $derived(creditGroups(entity.credits));
	const castGroups = $derived(groups.filter((g) => g.role === 'actor' || g.role === 'voice_actor'));
	const title = $derived(aboutTitle(entity.kind));
	const original = $derived(originalTitle(entity));
</script>

<section id="about" aria-labelledby="about-title" class="mb-14 scroll-mt-32 md:scroll-mt-20">
	<h2 id="about-title" class="mb-4 text-2xl font-bold">{title}</h2>

	<div class="flex flex-col gap-4">
		<!-- Плашка 1 и справа от неё (с lg) боковая колонка aside — «Производство и факты». -->
		<div class={['grid gap-4', aside && 'lg:grid-cols-[minmax(0,1fr)_20rem]']}>
			<!-- Описание — не строка таблицы, а текст: читают его, а не сканируют. Поэтому оно
			     идёт первым, крупнее остального и в колонке ограниченной ширины (длинная строка
			     на широком экране теряется при переходе на следующую). Факты — ниже, парами
			     подпись/значение с тонкими разделителями: так их видно по диагонали. -->
			{#if original || entity.description || rows.length}
				<div class="rounded-box bg-base-200 p-5 ring-1 ring-base-content/5 sm:p-7">
					{#if entity.description}
						<Clamp lines={6} class="max-w-[65ch] text-base leading-7 text-base-content/90">
							<p class="whitespace-pre-line">{entity.description}</p>
						</Clamp>
					{/if}

					<dl
						class={[
							'grid gap-x-4 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]',
							entity.description && 'mt-6 border-t border-base-content/10 pt-5'
						]}
					>
						{#if original}
							<dt class="pt-3 text-base-content/50">Оригинальное название</dt>
							<dd class="pb-3 font-medium sm:pt-3">{original}</dd>
						{/if}
						{#each rows as row (row.label)}
							<dt
								class="border-t border-base-content/5 pt-3 text-base-content/50 first:border-0 sm:border-t"
							>
								{row.label}
							</dt>
							<dd class="pb-3 sm:border-t sm:border-base-content/5 sm:pt-3">
								{#if row.links}
									{#each row.links as link, i (link.href)}{i ? ', ' : ''}<a
											href={link.href}
											class="font-medium decoration-primary/40 underline-offset-4 hover:text-primary hover:underline"
											>{link.text}</a
										>{/each}{#if row.more}<a
											href="#credits"
											class="ml-1 text-primary/80 underline decoration-dotted underline-offset-4 hover:text-primary"
										>
											и ещё {row.more}</a
										>{/if}
								{:else}
									{row.text}
								{/if}
							</dd>
						{/each}
					</dl>
				</div>
			{/if}
			{@render aside?.()}
		</div>

		<!-- Плашка 2, отдельно: полные титры по группам. Нет титров — нет и плашки. -->
		{#if castGroups.length}<Credits groups={castGroups} />{/if}
	</div>
</section>
