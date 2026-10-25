<script lang="ts">
	import type { SchemaReputation } from '#lib/api/generated/social.ts';
	import { reviewDate } from '#lib/social/reviews.ts';
	import { REPUTATION_BASE, reputationParts } from '#lib/social/profile.ts';

	// Рейтинг («карма») в виде прогресс-полосы до 500 баллов.
	// Заливка растёт пропорционально баллу, цвет меняется каждые 25: до 50 — серый, 500 — золотой.
	// Пересчёт балла идёт раз в сутки целиком, поэтому после лайка не анимируем:
	// свежий лайк виден в счётчике лайков сразу, а здесь — после ближайшего пересчёта.
	let {
		reputation,
		size = 'sm',
		color = 'primary'
	}: {
		reputation: SchemaReputation;
		/** Размер полосы: sm, md, lg. */
		size?: 'sm' | 'md' | 'lg';
		/** Цвет полосы: primary, error. */
		color?: 'primary' | 'error';
	} = $props();

	const BAR_MAX = 500;
	const STEP = 25;
	const BUCKETS = BAR_MAX / STEP; // 20 отрезков по 25 баллов
	const GRAY = '#94a3b8'; // 0–50 серый
	const FROM = '#3b82f6'; // цвет при 50
	const TO = '#d4af37'; // золото при 500

	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}
	function parseHex(hex: string): { r: number; g: number; b: number } {
		const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		if (!m) return { r: 148, g: 163, b: 184 };
		return {
			r: parseInt(m[1], 16),
			g: parseInt(m[2], 16),
			b: parseInt(m[3], 16)
		};
	}
	function toHex(r: number, g: number, b: number): string {
		return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
	}
	function interpolate(a: string, b: string, t: number): string {
		const ca = parseHex(a);
		const cb = parseHex(b);
		return toHex(lerp(ca.r, cb.r, t), lerp(ca.g, cb.g, t), lerp(ca.b, cb.b, t));
	}

	/** Цвет заливки полосы в зависимости от текущего балла. */
	export function reputationBarColor(value: number): string {
		const s = Math.max(0, Math.min(value, BAR_MAX));
		const bucket = Math.min(Math.floor(s / STEP), BUCKETS - 1); // 0..19
		if (bucket <= 1) return GRAY; // 0–50 серый
		return interpolate(FROM, TO, (bucket - 2) / (BUCKETS - 3)); // 50→500, конец — золотой
	}

	const barH = $derived(size === 'lg' ? 'h-3' : size === 'md' ? 'h-2' : 'h-1.5');
	const barW = $derived(size === 'lg' ? 'w-32' : size === 'md' ? 'w-24' : 'w-24');

	const score = $derived(reputation.score);
	const pct = $derived(Math.round((Math.min(Math.max(score, 0), BAR_MAX) / BAR_MAX) * 100));
	const barColor = $derived(reputationBarColor(score));
	const parts = $derived(reputationParts(reputation));
	const computed = $derived(reputation.computed_at);
</script>

<details class="group dropdown">
	<summary
		class="flex cursor-pointer list-none items-center gap-2.5 rounded-full bg-base-300/60 px-3 py-1.5 text-sm ring-1 ring-base-300 transition-colors hover:ring-primary/50"
		title="Рейтинг — из чего он сложился"
	>
		<span aria-hidden="true">★</span>
		<div
			class={["shrink-0 overflow-hidden rounded-full border border-base-content/20 bg-base-content/10", barH, barW]}
			aria-valuenow={pct}
			aria-valuemin={0}
			aria-valuemax={100}
			role="progressbar"
		>
			<div
				class="h-full shrink-0 transition-colors duration-300"
				style={`width: ${pct}%; background-color: ${color === "error" ? "#f43f5e" : barColor}`}
			></div>
		</div>
		<b class="tabular-nums">{score}</b>
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
