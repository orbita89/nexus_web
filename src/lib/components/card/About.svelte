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
	const castGroups = $derived(groups.filter((g) => g.role === 'actor' || g.role === 'voice_actor'));
	const title = $derived(aboutTitle(entity.kind));
	const original = $derived(originalTitle(entity));
</script>

<section id="about" aria-labelledby="about-title" class="mb-14 scroll-mt-32 md:scroll-mt-28">
	<h2 id="about-title" class="mb-4 text-2xl font-bold">{title}</h2>

	<div class="flex flex-col gap-4">
		<!-- Плашка 1 и справа от неё (с lg) боковая колонка aside — «Производство и факты». -->
		<!-- items-start: иначе таблица тянется на высоту боковой колонки, а лишняя высота уходит в
		     промежутки между строками — при длинном разборе справа подписи разъезжались по всей
		     плашке. Та же защита, что h-fit у Production. -->
		<div class={['grid items-start gap-4', aside && 'lg:grid-cols-[minmax(0,1fr)_20rem]']}>
			<!-- Плашка 1: одна таблица — оригинальное название, описание и факты, все строки с подписью. -->
			{#if original || entity.description || rows.length}
				<!-- Колонка подписей — по самой длинной из них (max-content), а сами подписи прижаты
				     вправо: при фиксированных 11rem между «Страна» и значением зияла половина ширины.
				     На телефоне подпись идёт над значением — там две колонки отнимали место у текста. -->
				<dl
					class="grid content-start gap-x-5 gap-y-2.5 rounded-box bg-base-200 p-5 text-sm ring-1 ring-base-content/5 max-sm:gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)] sm:p-7"
				>
					{#if original}
						<dt class="text-base-content/50 max-sm:text-xs sm:text-right">Оригинальное название</dt>
						<dd class="font-medium max-sm:mb-2">{original}</dd>
					{/if}
					{#if entity.description}
						<dt class="text-base-content/50 max-sm:text-xs sm:text-right">Описание</dt>
						<dd class="max-sm:mb-2">
							<Clamp lines={6} class="leading-7 text-base-content/90">
								<p class="whitespace-pre-line">{entity.description}</p>
							</Clamp>
						</dd>
					{/if}
					{#each rows as row (row.label)}
						<dt class="text-base-content/50 max-sm:text-xs sm:text-right">{row.label}</dt>
						<dd class="max-sm:mb-2">
							{#if row.links}
								<!-- Люди — ссылки, и это должно быть видно без наведения: приглушённое
								     подчёркивание, цветное на наведении. «Ещё N» ведёт к полным титрам и
								     отделено запятой — раньше оно слипалось с последним именем. -->
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
			{@render aside?.()}
		</div>

		<!-- Плашка 2, отдельно: полные титры по группам. Нет титров — нет и плашки. -->
		{#if castGroups.length}<Credits groups={castGroups} />{/if}
	</div>
</section>
