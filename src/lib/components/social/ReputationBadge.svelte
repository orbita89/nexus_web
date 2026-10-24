<script lang="ts">
	import type { SchemaReputation } from '#lib/api/generated/social.ts';
	import { reviewDate } from '#lib/social/reviews.ts';
	import { REPUTATION_BASE, reputationParts } from '#lib/social/profile.ts';

	// Рейтинг («карма»): стартовые 30 за регистрацию плюс веса за чужие лайки — лайк профиля +2,
	// лайк рецензии +1, реакция на коллекцию +1; дизлайки ничего не вычитают.
	//
	// Пересчёт идёт раз в сутки целиком, поэтому балл сознательно не анимируется после лайка:
	// свежий лайк виден в счётчике лайков сразу, а здесь — только после ближайшего прохода.
	// computed_at: null — пересчёта ещё не было, балл стартовый.
	let { reputation }: { reputation: SchemaReputation } = $props();

	const parts = $derived(reputationParts(reputation));
	const computed = $derived(reputation.computed_at);
</script>

<details class="group dropdown">
	<summary
		class="flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-base-300/60 px-3 py-1 text-sm ring-1 ring-base-300 transition-colors hover:ring-primary/50"
		title="Рейтинг — из чего он сложился"
	>
		<span aria-hidden="true">★</span>
		<b class="tabular-nums">{reputation.score}</b>
		<span class="text-base-content/50">рейтинг</span>
	</summary>
	<div
		class="dropdown-content z-30 mt-2 w-72 rounded-box bg-base-100 p-4 text-sm shadow-lg ring-1 ring-base-300"
	>
		<p class="mb-2 font-semibold">Из чего сложился балл</p>
		<dl class="flex flex-col gap-1">
			<div class="flex justify-between gap-3">
				<dt class="text-base-content/70">За регистрацию</dt>
				<dd class="tabular-nums">{REPUTATION_BASE}</dd>
			</div>
			{#each parts as part (part.key)}
				<div class="flex justify-between gap-3">
					<dt class="text-base-content/70">{part.title}</dt>
					<dd class="tabular-nums">{part.value}</dd>
				</div>
			{/each}
		</dl>
		<p class="mt-3 text-xs text-base-content/50">
			{#if computed}
				Пересчитывается раз в сутки; последний раз — {reviewDate(computed)}. Свежие лайки попадут в
				балл после ближайшего пересчёта.
			{:else}
				Пересчёта ещё не было — пока это стартовый балл за регистрацию.
			{/if}
		</p>
	</div>
</details>
