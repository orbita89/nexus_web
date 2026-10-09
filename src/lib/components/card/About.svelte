<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SchemaEntityCredit, SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import { aboutRows, aboutTitle, originalTitle, peopleCard } from '#lib/catalog/card.ts';
	import { count } from '#lib/catalog/labels.ts';
	import Clamp from '#lib/components/catalog/Clamp.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';

	// «О фильме» — две плашки. Первая — одна таблица с подписями, как у Кинопоиска: оригинальное
	// название, описание (в шапке их нет), год, страна, съёмочная группа, премьера, длительность.
	// Вторая, отдельно: режиссёр (у книг автор) и «В главных ролях» с фото — первые 9, остальные
	// под «Ещё N», чтобы длинный состав не растягивал страницу. Всё из каталога — в статическом
	// HTML. Справа от таблицы — aside (страница кладёт туда «Производство и факты»). Хронология —
	// отдельно и только когда она есть.
	let { entity, aside }: { entity: SchemaEntityDetail; aside?: Snippet } = $props();

	/** Актёров сразу; остальные — под «Ещё N». */
	const CAST_SHOWN = 9;

	const rows = $derived(aboutRows(entity));
	const people = $derived(peopleCard(entity));
	const title = $derived(aboutTitle(entity.kind));
	const original = $derived(originalTitle(entity));
</script>

{#snippet person(credit: SchemaEntityCredit)}
	<li class="min-w-0">
		<a
			href="/people/{credit.person.slug}"
			class="group -mx-2 flex items-center gap-3 rounded-box px-2 py-1.5 transition-colors hover:bg-base-content/5"
		>
			<PersonAvatar name={credit.person.full_name} photoUrl={credit.person.photo_url} size="sm" />
			<span class="min-w-0">
				<span class="block truncate text-sm font-medium group-hover:text-primary"
					>{credit.person.full_name}</span
				>
				{#if credit.character_name}
					<span class="block truncate text-xs text-base-content/45">{credit.character_name}</span>
				{/if}
			</span>
		</a>
	</li>
{/snippet}

{#snippet subheading(text: string, total?: number)}
	<h3
		class="mb-2 flex items-baseline gap-2 text-xs font-semibold tracking-widest text-base-content/50 uppercase"
	>
		{text}
		{#if total}<span class="font-normal tracking-normal text-base-content/35">{total}</span>{/if}
	</h3>
{/snippet}

<section id="about" aria-labelledby="about-title" class="mb-14 scroll-mt-32 md:scroll-mt-20">
	<h2 id="about-title" class="mb-4 text-2xl font-bold">{title}</h2>

	<div class="flex flex-col gap-4">
		<!-- Плашка 1 и справа от неё (с lg) боковая колонка aside — «Производство и факты». -->
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
									>{/each}
							{:else}
								{row.text}
							{/if}
						</dd>
					{/each}
				</dl>
			{/if}
			{@render aside?.()}
		</div>

		<!-- Плашка 2, отдельно: слева главная роль, справа актёры сеткой (первые CAST_SHOWN). -->
		{#if people}
			<div
				class="grid gap-6 rounded-box bg-base-200 p-5 ring-1 ring-base-content/5 sm:p-7 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8"
			>
				{#if people.lead}
					<div class="md:border-r md:border-base-content/10 md:pr-6">
						{@render subheading(people.lead.label)}
						<ul aria-label={people.lead.label}>
							{#each people.lead.credits as credit (credit.id)}{@render person(credit)}{/each}
						</ul>
					</div>
				{/if}
				{#if people.cast.length}
					<div class={['min-w-0', { 'md:col-span-2': !people.lead }]}>
						{@render subheading('В главных ролях', people.cast.length)}
						<ul class="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="В главных ролях">
							{#each people.cast.slice(0, CAST_SHOWN) as credit (credit.id)}{@render person(
									credit
								)}{/each}
						</ul>
						{#if people.cast.length > CAST_SHOWN}
							<details class="group/more mt-2">
								<summary
									class="cursor-pointer list-none text-sm text-primary group-open/more:mb-1 hover:underline"
								>
									Ещё {count(people.cast.length - CAST_SHOWN, ['актёр', 'актёра', 'актёров'])}
								</summary>
								<ul class="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
									{#each people.cast.slice(CAST_SHOWN) as credit (credit.id)}{@render person(
											credit
										)}{/each}
								</ul>
							</details>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</section>
