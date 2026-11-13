<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import { aboutRows, aboutTitle, creditGroups, crewVisible, originalTitle } from '#lib/catalog/card.ts';
	import Credits from './Credits.svelte';

	// «О фильме» — описание слева и студии справа (aside), под ними таблица фактов и титры.
	// Факты, уже выведенные справа от постера (AboutCompact), здесь не повторяем.
	let {
		entity,
		aside,
		factsInHero = false
	}: { entity: SchemaEntityDetail; aside?: Snippet; factsInHero?: boolean } = $props();

	const rows = $derived(factsInHero ? [] : aboutRows(entity));
	const groups = $derived(creditGroups(entity.credits));
	// У книг и картин блок титров не меняем: только актёры, как и раньше. Создатели — у фильмов и сериалов.
	const creditGroupsForPage = $derived(
		entity.kind === 'book' || entity.kind === 'painting'
			? groups.filter((g) => g.role === 'actor' || g.role === 'voice_actor')
			: groups.filter((g) => crewVisible(entity.kind, g.role))
	);
	const title = $derived(aboutTitle(entity.kind));
	// У сезона оригинальное название — почти всегда то же «Season N»: не показываем.
	const original = $derived(entity.kind === 'season' ? null : originalTitle(entity));
	const description = $derived(entity.description);
	const hasTable = $derived(!!(original || rows.length));
	const hasLeft = $derived(!!(description || hasTable));
	const hasAny = $derived(hasLeft || !!aside || creditGroupsForPage.length > 0);
</script>

{#if hasAny}<section
	id="about"
	aria-labelledby={factsInHero ? undefined : 'about-title'}
	class="mb-14 scroll-mt-32 md:scroll-mt-28"
>
	<!-- Заголовок «О …» уже над таблицей справа от постера — внизу его не повторяем. -->
	{#if !factsInHero}<h2 id="about-title" class="mb-4 text-2xl font-bold">{title}</h2>{/if}

	<div class="flex flex-col gap-4">
		<div
			class={[
				'grid items-start gap-6',
				aside && hasLeft && 'lg:grid-cols-[minmax(0,1fr)_260px]'
			]}
		>
			{#if hasLeft}
				<div class="flex min-w-0 flex-col gap-4">
					{#if description}
						<div class="rounded-box bg-base-200 p-5 text-sm ring-1 ring-base-content/5 sm:p-7">
							<h3
								class="mb-2 text-xs font-semibold tracking-widest text-base-content/50 uppercase"
							>
								Описание
							</h3>
							<p class="leading-7 whitespace-pre-line text-base-content/90">{description}</p>
						</div>
					{/if}
					{#if hasTable}
						<!-- Колонка подписей — по самой длинной из них (max-content), подписи прижаты вправо. -->
						<dl
							class="grid content-start gap-x-5 gap-y-2.5 rounded-box bg-base-200 p-5 text-sm ring-1 ring-base-content/5 max-sm:gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)] sm:p-7"
						>
							{#if original}
								<dt class="text-base-content/50 max-sm:text-xs sm:text-right">Оригинальное название</dt>
								<dd class="font-medium max-sm:mb-2">{original}</dd>
							{/if}
							{#each rows as row (row.label)}
								<dt class="text-base-content/50 max-sm:text-xs sm:text-right">{row.label}</dt>
								<dd class="max-sm:mb-2">
									{#if row.links}
										<!-- Люди — ссылки, видны без наведения. «Ещё N» ведёт к полным титрам. -->
										{#each row.links as link, i (link.href)}{i ? ', ' : ''}<a
												href={link.href}
												class="font-medium underline decoration-base-content/20 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/60"
												>{link.text}</a
											>{/each}{#if row.more}, <a
												href="#credits"
												class="whitespace-nowrap text-primary/80 hover:text-primary hover:underline"
												>ещё {row.more}</a
											>{/if}
									{:else}
										{row.text}
									{/if}
								</dd>
							{/each}
						</dl>
					{/if}
				</div>
			{/if}
			{@render aside?.()}
		</div>

		<!-- Плашка с полными титрами по группам. Нет титров — нет и плашки. -->
		{#if creditGroupsForPage.length}<Credits groups={creditGroupsForPage} />{/if}
	</div>
</section>{/if}
