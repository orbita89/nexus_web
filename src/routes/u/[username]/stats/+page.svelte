<script lang="ts">
	import { page } from '$app/state';
	import { unwrap } from '#lib/api/errors.ts';
	import { plural } from '#lib/catalog/labels.ts';
	import { byKindRows } from '#lib/social/profile.ts';
	import { profileQuery } from '#lib/social/profile-data.svelte.ts';
	import { REACTIONS } from '#lib/social/reactions.ts';
	import { displayName, formatRating } from '#lib/social/reviews.ts';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import ProfileComments from '#lib/components/social/ProfileComments.svelte';
	import ProfileMarks from '#lib/components/social/ProfileMarks.svelte';
	import ProfileRatings from '#lib/components/social/ProfileRatings.svelte';
	import StatsBlock from '#lib/components/social/StatsBlock.svelte';
	import type { PageProps } from './$types';

	// Вся аналитика профиля на одной вкладке: сводка (оценки с распределением, отметки, реакции,
	// комментарии, разрез по типам), а под ней сами списки — что оценено, где стоят отметки и где
	// оставлены комментарии. Отдельных вкладок под них нет: это один разговор про пользователя.
	//
	// Данные грузятся в браузере — у владельца закрытая статистика видна только с токеном.
	let { data }: PageProps = $props();

	const user = $derived(data.profile.user);
	const username = $derived(page.params.username!);
	const stats = profileQuery(
		() => username,
		(client, username) =>
			unwrap(
				client.social.GET('/api/v1/social/users/{username}/stats', {
					params: { path: { username } }
				})
			)
	);

	const ratings = $derived(stats.current?.ratings);
	// Распределение 1–10 рисуем столбиками от самой частой оценки.
	const peak = $derived(Math.max(1, ...(ratings?.distribution ?? [])));
	const rated = $derived(byKindRows(stats.current?.by_kind.rated ?? {}));
	const done = $derived(byKindRows(stats.current?.by_kind.done ?? {}));
</script>

<Seo
	title="Статистика — {displayName(user)} (@{user.username})"
	description="Оценки, отметки и активность @{user.username} в Nexus."
/>

<h2 class="sr-only">Статистика</h2>

<StatsBlock query={stats} username={user.username}>
	{#if stats.current && ratings}
		{@const s = stats.current}
		<div class="flex flex-col gap-8">
			<section aria-labelledby="stats-ratings" class="rounded-box bg-base-200 p-5">
				<h3 id="stats-ratings" class="mb-4 text-lg font-bold">Оценки</h3>
				{#if ratings.count}
					<div class="flex flex-wrap items-end gap-6">
						<p class="flex flex-col">
							<span class="text-4xl font-black tabular-nums">
								{ratings.average == null ? '—' : formatRating(ratings.average, { average: true })}
							</span>
							<span class="text-sm text-base-content/50">средняя оценка</span>
						</p>
						<p class="flex flex-col">
							<span class="text-4xl font-black tabular-nums">{ratings.count}</span>
							<span class="text-sm text-base-content/50">
								{plural(ratings.count, ['оценка', 'оценки', 'оценок'])}
							</span>
						</p>
						<p class="flex flex-col">
							<span class="text-4xl font-black tabular-nums">{s.reviews_with_text}</span>
							<span class="text-sm text-base-content/50">с текстом рецензии</span>
						</p>
					</div>
					<!-- Распределение по 1–10: ровно 10 чисел от бэкенда. -->
					<ul class="mt-6 flex items-end gap-1.5" aria-label="Распределение оценок">
						{#each ratings.distribution as n, i (i)}
							<li class="flex flex-1 flex-col items-center gap-1">
								<span class="text-xs text-base-content/50 tabular-nums">{n || ''}</span>
								<span
									class="w-full rounded-t bg-primary/70"
									style="height: {Math.round((n / peak) * 80) + 2}px"
									title="{i + 1}: {n}"
								></span>
								<span class="text-xs text-base-content/50 tabular-nums">{i + 1}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-base-content/50">Оценок пока нет.</p>
				{/if}
			</section>

			<div class="grid gap-5 sm:grid-cols-2">
				<section aria-labelledby="stats-marks" class="rounded-box bg-base-200 p-5">
					<h3 id="stats-marks" class="mb-3 text-lg font-bold">Отметки</h3>
					<dl class="flex flex-col gap-2 text-sm">
						<div class="flex justify-between gap-3">
							<dt class="text-base-content/70">Посмотреть позже</dt>
							<dd class="font-semibold tabular-nums">{s.marks.later}</dd>
						</div>
						<div class="flex justify-between gap-3">
							<dt class="text-base-content/70">Просмотрено</dt>
							<dd class="font-semibold tabular-nums">{s.marks.done}</dd>
						</div>
					</dl>
				</section>

				<section aria-labelledby="stats-comments" class="rounded-box bg-base-200 p-5">
					<h3 id="stats-comments" class="mb-3 text-lg font-bold">Комментарии</h3>
					<dl class="flex flex-col gap-2 text-sm">
						<div class="flex justify-between gap-3">
							<dt class="text-base-content/70">К рецензиям</dt>
							<dd class="font-semibold tabular-nums">{s.comments.reviews}</dd>
						</div>
						<div class="flex justify-between gap-3">
							<dt class="text-base-content/70">В обсуждениях подборок</dt>
							<dd class="font-semibold tabular-nums">{s.comments.collections}</dd>
						</div>
					</dl>
				</section>

				<section aria-labelledby="stats-reactions" class="rounded-box bg-base-200 p-5">
					<h3 id="stats-reactions" class="mb-3 text-lg font-bold">Реакции</h3>
					<ul class="flex flex-wrap gap-3">
						{#each REACTIONS as r (r.key)}
							<li class="flex items-center gap-1.5" title={r.label}>
								<span class="text-lg" aria-hidden="true">{r.emoji}</span>
								<span class="font-semibold tabular-nums">{s.reactions[r.key]}</span>
								<span class="sr-only">{r.label}</span>
							</li>
						{/each}
					</ul>
				</section>

				<section aria-labelledby="stats-kinds" class="rounded-box bg-base-200 p-5">
					<h3 id="stats-kinds" class="mb-3 text-lg font-bold">По разделам</h3>
					{#if rated.length || done.length}
						<div class="grid grid-cols-2 gap-4 text-sm">
							<div>
								<p class="mb-1 text-xs tracking-wider text-base-content/50 uppercase">Оценено</p>
								<dl class="flex flex-col gap-1">
									{#each rated as row (row.title)}
										<div class="flex justify-between gap-3">
											<dt class="text-base-content/70">{row.title}</dt>
											<dd class="font-semibold tabular-nums">{row.value}</dd>
										</div>
									{:else}
										<p class="text-base-content/50">—</p>
									{/each}
								</dl>
							</div>
							<div>
								<p class="mb-1 text-xs tracking-wider text-base-content/50 uppercase">
									Просмотрено
								</p>
								<dl class="flex flex-col gap-1">
									{#each done as row (row.title)}
										<div class="flex justify-between gap-3">
											<dt class="text-base-content/70">{row.title}</dt>
											<dd class="font-semibold tabular-nums">{row.value}</dd>
										</div>
									{:else}
										<p class="text-base-content/50">—</p>
									{/each}
								</dl>
							</div>
						</div>
					{:else}
						<p class="text-base-content/50">Пока ничего.</p>
					{/if}
				</section>
			</div>
		</div>
	{/if}
</StatsBlock>

<!-- Списки монтируются только после сводки: если статистика закрыта, они получили бы те же три
     403 без всякой пользы. -->
{#if stats.current}
	<div class="mt-10 flex flex-col gap-10">
		<ProfileRatings {username} />
		<ProfileMarks {username} />
		<ProfileComments {username} />
	</div>
{/if}
