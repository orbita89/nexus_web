<script lang="ts">
	import type { SchemaNomination } from '#lib/api/generated/catalog.ts';
	import {
		awardCatalogHref,
		categoryTitle,
		editionMeta,
		nominee,
		type Nominee
	} from '#lib/catalog/awards.ts';
	import AwardLogo from '#lib/components/catalog/AwardLogo.svelte';
	import EntityCard from '#lib/components/catalog/EntityCard.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';
	import Poster from '#lib/components/catalog/Poster.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import ChatButton from '#lib/components/chat/ChatButton.svelte';
	import type { PageProps } from './$types';

	// Церемония — бюллетень: у «Оскара» 24 категории по 5–11 номинаций. Победители крупно,
	// остальные — компактными строками в две колонки, сверху оглавление по категориям:
	// иначе страница превращается в простыню, по которой нечем ориентироваться.
	let { data }: PageProps = $props();

	const edition = $derived(data.edition);
	const meta = $derived(editionMeta(edition));
	const title = $derived(`${edition.award.title} ${edition.year}`);

	const rating = (nomination: SchemaNomination) =>
		nomination.entity ? data.ratings[nomination.entity.slug] : undefined;
	/** Подпись под карточкой и строкой: соавторы и роль. */
	const note = (who: Nominee) => [who.people, who.role].filter(Boolean).join(' · ');
</script>

<Seo
	{title}
	description="Победители и номинанты: {title}."
	image={edition.cover_url ?? edition.award.logo_url}
/>

<nav class="mb-4 text-sm text-base-content/50" aria-label="Хлебные крошки">
	<a href="/awards" class="link-hover">Награды</a>
	<span aria-hidden="true"> / </span>
	<a href="/awards/{edition.award.slug}" class="link-hover">{edition.award.title}</a>
</nav>

<header class="mb-8 flex flex-wrap items-start gap-4">
	<AwardLogo title={edition.award.title} logoUrl={edition.award.logo_url} size="size-16" />
	<div class="min-w-0 flex-1">
		<h1 class="text-3xl font-black sm:text-4xl">{title}</h1>
		{#if meta.length}<p class="mt-2 text-sm text-base-content/50">{meta.join(' · ')}</p>{/if}
		<div class="mt-4 flex flex-wrap items-center gap-2">
			<a
				href={awardCatalogHref(edition.award.kinds, edition.award.slug, edition.year)}
				class="btn rounded-full btn-sm">Работы в каталоге</a
			>
			<!-- Чат церемонии: до объявления лауреатов это самый живой разговор раздела. -->
			<ChatButton
				meta={{
					room: `award:${edition.award.slug}-${edition.year}`,
					title,
					href: `/awards/${edition.award.slug}/${edition.year}`,
					image: edition.cover_url ?? edition.award.logo_url ?? null
				}}
			/>
		</div>
	</div>
</header>

{#if edition.categories.length > 3}
	<!-- Оглавление: 24 категории листать сверху вниз в поисках нужной невозможно. -->
	<nav class="mb-8 flex flex-wrap gap-1.5" aria-label="Категории">
		{#each edition.categories as category (category.slug)}
			<a href="#{category.slug}" class="badge badge-ghost badge-sm hover:badge-primary"
				>{categoryTitle(category, category.nominations[0])}</a
			>
		{/each}
	</nav>
{/if}

<div class="flex flex-col gap-10">
	{#each edition.categories as category (category.slug)}
		{@const winners = category.nominations.filter((n) => n.won)}
		{@const rest = category.nominations.filter((n) => !n.won)}
		<section id={category.slug} class="scroll-mt-20 rounded-box border border-base-300 p-4 sm:p-5">
			<h2 class="mb-4 text-lg font-bold sm:text-xl">
				{categoryTitle(category, category.nominations[0])}
				<span class="ml-1 text-sm font-normal text-base-content/40"
					>{category.nominations.length}</span
				>
			</h2>

			<div class="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
				<!-- Победители: постер работы, под ним — человек, если номинация и на него тоже. -->
				{#if winners.length}
					<ul class="flex flex-wrap gap-5">
						{#each winners as nomination (nomination.id)}
							{@const who = nominee(nomination)}
							<!-- Колонка под содержимое: постер уже круглого фото (PersonAvatar lg). -->
							<li class={nomination.entity ? 'w-32 sm:w-36' : 'w-40 sm:w-48'}>
								<div class="relative">
									{#if nomination.entity}
										<EntityCard entity={nomination.entity} rating={rating(nomination)} />
									{:else if nomination.person}
										<a href={who.href} class="group block text-center">
											<span class="flex justify-center">
												<PersonAvatar
													name={nomination.person.full_name}
													photoUrl={nomination.person.photo_url}
													size="lg"
												/>
											</span>
											<span class="mt-2 block text-sm font-bold group-hover:text-primary"
												>{who.title}</span
											>
										</a>
									{:else}
										<!-- Ни работы, ни человека в каталоге («Scientific and Engineering Award»):
										     плашка по тексту, пустой постер 2:3 выглядел бы потерянной картинкой. -->
										<span
											class="block rounded-box bg-base-300 px-3 py-4 text-center text-sm font-semibold"
											>{who.title}</span
										>
									{/if}
									<span
										class="absolute -top-2 -left-2 z-10 badge badge-sm badge-primary"
										title="Победитель">🏆</span
									>
								</div>
								{#if who.person}
									<a
										href={who.person.href}
										class="mt-1.5 flex items-center gap-1.5 text-xs font-semibold link-hover"
									>
										<PersonAvatar
											name={who.person.name}
											photoUrl={nomination.person?.photo_url}
											size="sm"
										/>
										<span class="min-w-0 flex-1 truncate">{who.person.name}</span>
									</a>
								{/if}
								{#if note(who)}
									<span class="mt-1 line-clamp-2 block text-xs text-base-content/50"
										>{note(who)}</span
									>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				<!-- Номинанты: строки с миниатюрой — десять крупных карточек в категории не читаются. -->
				{#if rest.length}
					<ul class="grid gap-x-6 gap-y-1 self-start sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
						{#if winners.length}
							<li class="text-xs tracking-wide text-base-content/40 uppercase sm:col-span-full">
								Номинанты
							</li>
						{/if}
						{#each rest as nomination (nomination.id)}
							{@const who = nominee(nomination)}
							<!-- min-w-0: ячейка grid по умолчанию не уже своего содержимого. -->
							<li class="min-w-0">
								<svelte:element
									this={who.href ? 'a' : 'div'}
									href={who.href}
									class={[
										'flex items-center gap-2 rounded px-2 py-1.5',
										who.href ? 'hover:bg-base-200' : 'cursor-default'
									]}
								>
									{#if nomination.entity}
										<span class="w-8 shrink-0">
											<Poster
												title={nomination.entity.title}
												kind={nomination.entity.kind}
												coverUrl={nomination.entity.cover_url}
												small
											/>
										</span>
									{:else if nomination.person}
										<PersonAvatar
											name={nomination.person.full_name}
											photoUrl={nomination.person.photo_url}
											size="sm"
										/>
									{/if}
									<!-- flex-1 + min-w-0: без них длинное название не обрезается и вылезает за край. -->
									<span class="block min-w-0 flex-1">
										<span class="block truncate text-sm font-medium">{who.title}</span>
										{#if who.person}
											<span class="block truncate text-xs text-primary/80">{who.person.name}</span>
										{/if}
										{#if note(who)}
											<span class="line-clamp-1 block text-xs text-base-content/45"
												>{note(who)}</span
											>
										{/if}
									</span>
								</svelte:element>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/each}
</div>
