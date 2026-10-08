<script lang="ts">
	import { unwrap } from '#lib/api/errors.ts';
	import { session } from '#lib/auth/session.svelte.ts';
	import { kindByApi } from '#lib/catalog/kinds.ts';
	import {
		ageRating,
		formatDate,
		keyFacts,
		leadCredits,
		metadataFields,
		roleLabel,
		summary,
		yearOf
	} from '#lib/catalog/labels.ts';
	import { trailerSources } from '#lib/catalog/trailer.ts';
	import CardHero from '#lib/components/catalog/CardHero.svelte';
	import ClientSection from '#lib/components/catalog/ClientSection.svelte';
	import PersonAvatar from '#lib/components/catalog/PersonAvatar.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TagChips from '#lib/components/catalog/TagChips.svelte';
	import TrailerButton from '#lib/components/catalog/TrailerButton.svelte';
	import AddToCollection from '#lib/components/social/AddToCollection.svelte';
	import CardCollections from '#lib/components/social/CardCollections.svelte';
	import CardReviews from '#lib/components/social/CardReviews.svelte';
	import CardThreads from '#lib/components/social/CardThreads.svelte';
	import NewThreadButton from '#lib/components/social/NewThreadButton.svelte';
	import RatingBadge from '#lib/components/social/RatingBadge.svelte';
	import WatchButton from '#lib/components/social/WatchButton.svelte';
	import { useRealtime } from '#lib/realtime/realtime.svelte.ts';
	import { browserApi, CardLive, liveQuery } from '#lib/social/card-live.svelte.ts';
	import type { PageProps } from './$types';

	// Карточка как у Okko: трейлер — фон шапки, поверх — название, факты, описание и кнопки.
	// Постера на карточке нет: он — в сетках разделов.
	// Страница статическая (+page.server.ts): в data только каталог. Личное (оценка, «Следить»,
	// «В коллекцию») и живое (рецензии, обсуждения, коллекции) — компоненты, которые сами
	// грузят данные в браузере.
	let { data }: PageProps = $props();

	let hero = $state<CardHero>();

	const entity = $derived(data.entity);
	const kind = $derived(kindByApi(entity.kind));
	const year = $derived(yearOf(entity.release_date));
	const trailers = $derived(trailerSources(entity));
	const facts = $derived([
		...keyFacts(entity.kind, entity.metadata, entity.release_date).slice(0, 1),
		...entity.tags.slice(0, 2).map((t) => t.name),
		...keyFacts(entity.kind, entity.metadata, entity.release_date).slice(1)
	]);
	const age = $derived(ageRating(entity.kind, entity.metadata));
	const lead = $derived(leadCredits(entity.kind, entity.credits));
	const fields = $derived([
		...(entity.release_date
			? [{ label: 'Дата выхода', value: formatDate(entity.release_date) }]
			: []),
		...metadataFields(entity.kind, entity.metadata)
	]);

	// Живое — в браузере: сводка оценок сразу (бейдж в шапке и раздел рецензий), остальное —
	// блоками в ClientSection. Чужие рецензии и темы о произведении — тихо перечитываем всё
	// живое (пачку событий — одним разом); свои действия — тоже через live.refresh().
	const live = new CardLive();
	const rating = liveQuery(
		() => ({ slug: entity.slug, version: live.version }),
		({ slug }) =>
			unwrap(
				browserApi().social.GET('/api/v1/social/entities/{slug}/rating', {
					params: { path: { slug } }
				})
			)
	);
	const average = $derived(rating.current?.data?.count ? rating.current.data.average : null);

	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	function refreshSoon() {
		clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => live.refresh(), 800);
	}
	useRealtime(
		() => [`entity:${entity.slug}`],
		(event) => {
			if (event.data.author_id === session.user?.id) return;
			if (event.event.startsWith('review.') || event.event.startsWith('thread.')) refreshSoon();
		},
		refreshSoon
	);

	const description = $derived(
		summary(entity.description) ||
			`${kind.one} «${entity.title}»${year ? ` (${year})` : ''}: оценки, рецензии и обсуждения в Nexus.`
	);
</script>

<Seo title="{entity.title}{year ? ` (${year})` : ''}" {description} image={entity.cover_url} />

{#key entity.id}
	<CardHero
		bind:this={hero}
		sources={trailers}
		title={entity.title}
		kind={entity.kind}
		coverUrl={entity.cover_url}
	>
		<nav aria-label="Раздел" class="text-sm font-semibold tracking-widest uppercase">
			<a href="/{kind.slug}" class="link text-primary link-hover">{kind.one}</a>
		</nav>
		<h1 class="mt-2 text-4xl leading-none font-black tracking-tight drop-shadow-lg sm:text-6xl">
			{entity.title}
		</h1>
		{#if entity.original_title && entity.original_title !== entity.title}
			<p class="mt-2 text-lg text-base-content/60">{entity.original_title}</p>
		{/if}

		{#if facts.length || age || average != null}
			<p class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-medium text-base-content/70">
				{#if average != null}<RatingBadge value={average} average />{/if}
				{#each facts as fact, i (i)}<span>{fact}</span>{/each}
				{#if age}<span class="badge badge-outline badge-sm font-semibold">{age}</span>{/if}
			</p>
		{/if}

		{#if entity.description}
			<p class="mt-3 line-clamp-4 text-lg leading-snug text-base-content/90">
				{entity.description}
			</p>
		{/if}

		{#if lead}
			<p class="mt-4 text-base-content/60">
				{lead.label}:
				{#each lead.people as person, i (person.slug)}{i ? ', ' : ''}<a
						href="/people/{person.slug}"
						class="link font-medium text-base-content decoration-base-content/30 underline-offset-4 hover:text-primary"
						>{person.full_name}</a
					>{/each}
			</p>
		{/if}

		<div class="mt-6 flex flex-wrap gap-3">
			{#if trailers.length}
				<TrailerButton
					sources={trailers}
					title={entity.title}
					coverUrl={entity.cover_url}
					onopen={() => hero?.pause()}
					onclose={() => hero?.resume()}
				/>
			{/if}
			<WatchButton slug={entity.slug} entityId={entity.id} />
			<AddToCollection slug={entity.slug} title={entity.title} onchange={() => live.refresh()} />
		</div>
	</CardHero>
{/key}

<!-- Живое: в статический HTML входят только заголовки. Блок монтируется, когда раздел подходит
     к экрану, и сам грузит данные из API. key — у новой карточки всё заново, в том числе ленивость. -->
{#key entity.id}
	<ClientSection id="reviews" title="Оценки и рецензии" placeholder="h-96">
		<CardReviews slug={entity.slug} rating={rating.current} {live} />
	</ClientSection>

	<ClientSection id="threads" title="Обсуждения" placeholder="h-48">
		{#snippet actions()}
			<NewThreadButton entity={entity.slug} label="Начать обсуждение" />
		{/snippet}
		<CardThreads slug={entity.slug} {live} />
	</ClientSection>

	<ClientSection id="collections" title="В коллекциях" placeholder="h-40">
		<CardCollections slug={entity.slug} {live} />
	</ClientSection>
{/key}

<div class="grid gap-10 lg:grid-cols-[1fr_20rem]">
	<div class="min-w-0">
		{#if entity.credits.length}
			<section aria-labelledby="credits-title">
				<h2 id="credits-title" class="mb-4 text-xl font-bold">Участники</h2>
				<ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{#each entity.credits as credit (credit.id)}
						<li>
							<a
								href="/people/{credit.person.slug}"
								class="group flex items-center gap-3 rounded-box p-2 transition-colors hover:bg-base-200"
							>
								<PersonAvatar
									name={credit.person.full_name}
									photoUrl={credit.person.photo_url}
									size="sm"
								/>
								<span class="min-w-0">
									<span class="block truncate font-medium group-hover:text-primary"
										>{credit.person.full_name}</span
									>
									<span class="block truncate text-xs text-base-content/50">
										{[roleLabel(credit.role), credit.character_name].filter(Boolean).join(' · ')}
									</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>

	<aside class="flex flex-col gap-6">
		{#if fields.length}
			<section aria-labelledby="about-title">
				<h2 id="about-title" class="mb-3 text-xl font-bold">
					О {kind.kind === 'book'
						? 'книге'
						: kind.kind === 'game'
							? 'игре'
							: kind.kind === 'series'
								? 'сериале'
								: 'фильме'}
				</h2>
				<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
					{#each fields as field (field.label)}
						<dt class="text-base-content/50">{field.label}</dt>
						<dd>{field.value}</dd>
					{/each}
				</dl>
			</section>
		{/if}
		{#if entity.tags.length}
			<section aria-labelledby="tags-title">
				<h2 id="tags-title" class="mb-3 text-xl font-bold">Теги</h2>
				<TagChips tags={entity.tags} />
			</section>
		{/if}
	</aside>
</div>
