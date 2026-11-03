<script lang="ts">
	import type { SchemaEntityDetail } from '#lib/api/generated/catalog.ts';
	import {
		aboutGroups,
		aboutTitle,
		creditGroups,
		type Production as ProductionData
	} from '#lib/catalog/card.ts';
	import Clamp from '#lib/components/catalog/Clamp.svelte';
	import Credits from './Credits.svelte';
	import Production from './Production.svelte';

	// «О фильме» — одна плашка: описание сверху, под ним факты колонками («Главное», «Съёмочная
	// группа», «Производство и факты»). Колонками, а не списком в двенадцать строк: список
	// растягивал раздел на полтора экрана и оставлял половину ширины пустой. Полные титры с фото —
	// отдельной плашкой ниже (Credits), её рисуем только когда титры есть.
	let { entity, production }: { entity: SchemaEntityDetail; production?: ProductionData | null } =
		$props();

	const groups = $derived(aboutGroups(entity));
	const castGroups = $derived(
		creditGroups(entity.credits).filter((g) => g.role === 'actor' || g.role === 'voice_actor')
	);
	const title = $derived(aboutTitle(entity.kind));
	/** Колонок в сетке: третья — только когда есть что в неё положить. */
	const columns = $derived(groups.length + (production ? 1 : 0));
</script>

<section id="about" aria-labelledby="about-title" class="mb-14 scroll-mt-32 md:scroll-mt-20">
	<h2 id="about-title" class="mb-4 text-2xl font-bold">{title}</h2>

	<div class="flex flex-col gap-4">
		<div class="rounded-box bg-base-200 p-5 ring-1 ring-base-content/5 sm:p-7">
			{#if entity.description}
				<Clamp lines={6} class="max-w-[70ch] text-base leading-7 text-base-content/90">
					<p class="whitespace-pre-line">{entity.description}</p>
				</Clamp>
			{/if}

			<!-- Пары «подпись сверху, значение снизу»: подпись мелкая и приглушённая, значение
			     обычного размера. Разделители не нужны — группы и так разведены колонками, а линия
			     на каждой строке превращала блок в забор. -->
			<div
				class={[
					'grid gap-x-10 gap-y-8 sm:grid-cols-2',
					entity.description && 'mt-7 border-t border-base-content/10 pt-6',
					columns >= 3 && 'lg:grid-cols-3'
				]}
			>
				{#each groups as group (group.title)}
					<section aria-label={group.title}>
						<h3 class="mb-3 text-xs font-semibold tracking-widest text-base-content/40 uppercase">
							{group.title}
						</h3>
						<dl class="flex flex-col gap-3 text-sm">
							{#each group.rows as row (row.label)}
								<div>
									<dt class="text-xs text-base-content/45">{row.label}</dt>
									<dd class="mt-0.5">
										{#if row.links}
											{#each row.links as link, i (link.href)}{i ? ', ' : ''}<a
													href={link.href}
													class="decoration-primary/40 underline-offset-4 hover:text-primary hover:underline"
													>{link.text}</a
												>{/each}{#if row.more}<a
													href="#credits"
													class="ml-1 whitespace-nowrap text-primary/80 hover:text-primary hover:underline"
													>ещё {row.more}</a
												>{/if}
										{:else}
											{row.text}
										{/if}
									</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/each}

				<!-- Студии, награды и факты — в той же плашке третьей колонкой: отдельная карточка
				     справа была вдвое короче и оставляла под собой дыру. -->
				{#if production}
					<Production {production} bare />
				{/if}
			</div>
		</div>

		<!-- Плашка 2, отдельно: полные титры по группам. Нет титров — нет и плашки. -->
		{#if castGroups.length}<Credits groups={castGroups} />{/if}
	</div>
</section>
