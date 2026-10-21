<script lang="ts">
	import type { FeaturedThemeId } from '#lib/catalog/themes.ts';
	import { themeAccent, type WallpaperMode } from '#lib/social/featuredThemes.ts';

	// Тематический фон всей страницы особой коллекции: размытые обои сверху с затуханием и
	// декоративный слой по theme (кровь, сердечки, снег, звёзды). Только CSS/инлайн-SVG,
	// анимация — transform/opacity, отключается при prefers-reduced-motion.
	// preview — уменьшенная копия для формы оформления (absolute внутри родителя).
	// mode 'page' — обои фиксированным фоном всей страницы (cover, затемнение dim %, размытие blur px);
	// 'header' — обои только в шапке, здесь лишь мягкий отсвет сверху с затуханием.
	// effects false — без декоративных слоёв. accent — CSS-цвет акцента (свой или темы).
	let {
		themeId,
		wallpaperUrl = null,
		preview = false,
		mode = 'header',
		dim = 55,
		blur = 0,
		effects = true,
		accent = null
	}: {
		themeId: FeaturedThemeId | null;
		wallpaperUrl?: string | null;
		preview?: boolean;
		mode?: WallpaperMode;
		dim?: number;
		blur?: number;
		effects?: boolean;
		accent?: string | null;
	} = $props();

	const decor = $derived(
		!effects
			? 'none'
			: themeId === 'horror' || themeId === 'halloween'
				? 'blood'
				: themeId === 'romance'
					? 'hearts'
					: themeId === 'new-year'
						? 'snow'
						: themeId === 'sci-fi'
							? 'stars'
							: 'glow'
	);
	const acc = $derived(accent ?? themeAccent(themeId));
	// В превью размытие пропорционально меньше.
	const blurPx = $derived(preview ? blur / 4 : blur);

	const uid = $props.id();
	// Детерминированные параметры (без случайности — одинаково на SSR и клиенте).
	const DRIPS = Array.from({ length: 22 }, (_, i) => ({
		x: i * 4.6 + ((i * 37) % 3),
		w: 1.2 + ((i * 13) % 5) * 0.35,
		h: 6 + ((i * 29) % 11) * 2.6,
		d: (i * 0.7) % 6
	}));
	const HEARTS = Array.from({ length: 14 }, (_, i) => ({
		x: (i * 41) % 100,
		y: 8 + ((i * 23) % 80),
		s: 10 + ((i * 7) % 4) * 5,
		r: ((i * 31) % 50) - 25
	}));
	const FLAKES = Array.from({ length: 28 }, (_, i) => ({
		x: (i * 37) % 100,
		s: 2 + (i % 3),
		dur: 9 + ((i * 7) % 9),
		d: -((i * 1.3) % 15)
	}));
</script>

<div
	class={[
		'pointer-events-none overflow-hidden',
		preview ? 'absolute inset-0 -z-10' : 'fixed inset-0 -z-10'
	]}
	aria-hidden="true"
	style:--acc={acc}
>
	<div
		class="absolute inset-0"
		style="background: radial-gradient(120% 60% at 50% 0%, color-mix(in oklab, var(--acc) 16%,
		transparent), transparent 70%)"
	></div>
	{#if wallpaperUrl && mode === 'page'}
		<img
			src={wallpaperUrl}
			alt=""
			class="absolute inset-0 h-full w-full object-cover"
			class:scale-105={blurPx > 0}
			style:filter={blurPx ? `blur(${blurPx}px)` : null}
		/>
		<div class="absolute inset-0 bg-base-100" style:opacity={dim / 100}></div>
	{:else if wallpaperUrl}
		<img
			src={wallpaperUrl}
			alt=""
			class="absolute inset-x-0 top-0 h-[70%] w-full scale-110 object-cover opacity-35 blur-2xl"
			style="mask-image: linear-gradient(to bottom, #000 20%, transparent); -webkit-mask-image: linear-gradient(to bottom, #000 20%, transparent)"
		/>
	{/if}

	{#if decor === 'blood'}
		<div
			class="absolute inset-0"
			style="background: radial-gradient(140% 90% at 50% 50%, transparent 55%, color-mix(in oklab, #7f0000 35%, transparent))"
		></div>
		<svg
			class="absolute inset-x-0 top-0 w-full {preview ? 'h-full' : 'h-[45vh]'}"
			viewBox="0 0 100 40"
			preserveAspectRatio="none"
		>
			<defs>
				<linearGradient id="cb-blood-{uid}" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stop-color="#3a0000" />
					<stop offset="0.6" stop-color="#8b0000" />
					<stop offset="1" stop-color="#b3001b" />
				</linearGradient>
			</defs>
			<rect x="0" y="0" width="100" height="2.2" fill="url(#cb-blood-{uid})" />
			{#each DRIPS as d, i (i)}
				<g class="drip" style:animation-delay="{d.d}s" style:transform-origin="{d.x}px 0">
					<rect
						x={d.x}
						y="0"
						width={d.w}
						height={d.h}
						rx={d.w / 2}
						fill="url(#cb-blood-{uid})"
						opacity="0.85"
					/>
					<ellipse
						cx={d.x + d.w / 2}
						cy={d.h}
						rx={d.w * 0.8}
						ry={d.w}
						fill="#9b0014"
						opacity="0.85"
					/>
				</g>
			{/each}
		</svg>
	{:else if decor === 'hearts'}
		<div
			class="absolute inset-0"
			style="background: radial-gradient(80% 50% at 80% 10%, color-mix(in oklab, #ff4d8d 18%, transparent), transparent 70%), radial-gradient(60% 40% at 10% 60%, color-mix(in oklab, #ff4d8d 10%, transparent), transparent 70%)"
		></div>
		{#each HEARTS as h, i (i)}
			<svg
				class="heart absolute"
				style:left="{h.x}%"
				style:top="{h.y}%"
				style:width="{preview ? h.s / 2 : h.s}px"
				style:rotate="{h.r}deg"
				style:animation-delay="{-i * 0.6}s"
				viewBox="0 0 24 24"
			>
				<path
					d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z"
					fill="#ff5c95"
					opacity="0.22"
				/>
			</svg>
		{/each}
	{:else if decor === 'snow'}
		<div
			class="absolute inset-0"
			style="background: linear-gradient(to bottom, color-mix(in oklab, var(--color-info) 12%, transparent), transparent 60%)"
		></div>
		{#each FLAKES as f, i (i)}
			<span
				class="flake absolute -top-2 rounded-full bg-white/60"
				style:left="{f.x}%"
				style:width="{f.s}px"
				style:height="{f.s}px"
				style:animation-duration="{f.dur}s"
				style:animation-delay="{f.d}s"
			></span>
		{/each}
	{:else if decor === 'stars'}
		<div
			class="stars absolute inset-0"
			style="background-image: radial-gradient(1px 1px at 20px 30px, #fff9, transparent), radial-gradient(1px 1px at 90px 120px, #fff7, transparent), radial-gradient(1.5px 1.5px at 160px 60px, #fffa, transparent), radial-gradient(1px 1px at 230px 180px, #fff6, transparent); background-size: 260px 220px"
		></div>
		<div
			class="absolute inset-x-0 bottom-0 h-1/2"
			style="background-image: linear-gradient(color-mix(in oklab, var(--acc) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--acc) 18%, transparent) 1px, transparent 1px); background-size: 48px 48px; mask-image: linear-gradient(to top, #000, transparent); -webkit-mask-image: linear-gradient(to top, #000, transparent)"
		></div>
	{/if}
</div>

<style>
	.drip {
		animation: drip 7s ease-in-out infinite;
	}
	@keyframes drip {
		0%,
		100% {
			transform: scaleY(1);
		}
		50% {
			transform: scaleY(1.18);
		}
	}
	.heart {
		animation: float 8s ease-in-out infinite;
	}
	@keyframes float {
		50% {
			transform: translateY(-10px);
			opacity: 0.6;
		}
	}
	.flake {
		animation: fall linear infinite;
	}
	@keyframes fall {
		to {
			transform: translateY(105vh);
		}
	}
	.stars {
		animation: twinkle 6s ease-in-out infinite;
	}
	@keyframes twinkle {
		50% {
			opacity: 0.55;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.drip,
		.heart,
		.flake,
		.stars {
			animation: none;
		}
	}
</style>
