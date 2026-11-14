<script lang="ts" module>
	/** Оттенок (hue, oklch) для роли: бейдж, свечение и заглушка фото берут его из --h. */
	export const ROLE_HUE: Record<string, number> = {
		actor: 50,
		director: 295,
		writer: 235,
		producer: 85,
		composer: 350,
		cinematographer: 190,
		editor: 215,
		voice_actor: 15,
		author: 160,
		illustrator: 125,
		artist: 320,
		creator: 265,
		developer: 250,
		game_designer: 25
	};

	export function roleHue(role?: string | null): number {
		return (role && ROLE_HUE[role]) || 50;
	}
</script>

<script lang="ts">
	import { roleLabel } from '#lib/catalog/labels.ts';

	let {
		slug,
		name,
		original,
		photoUrl,
		role,
		featured = false,
		rank
	}: {
		slug: string;
		name: string;
		original?: string | null;
		photoUrl?: string | null;
		role?: string | null;
		featured?: boolean;
		rank?: number;
	} = $props();

	let failed = $state(false);
	const initials = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase()
	);
	const showOriginal = $derived(original && original !== name ? original : null);
</script>

<a
	href="/people/{slug}"
	style="--h: {roleHue(role)}"
	class={[
		'group relative block overflow-hidden rounded-box border border-base-content/10 bg-base-200 transition duration-300',
		'hover:-translate-y-1 hover:border-[oklch(0.7_0.15_var(--h)/0.6)] hover:shadow-[0_12px_32px_-12px_oklch(0.7_0.18_var(--h)/0.55)]',
		'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
		featured ? 'aspect-4/5' : 'aspect-3/4'
	]}
>
	{#if photoUrl && !failed}
		<img
			src={photoUrl}
			alt=""
			loading="lazy"
			onerror={() => (failed = true)}
			class="absolute inset-0 size-full object-cover object-top transition duration-500 group-hover:scale-105"
		/>
	{:else}
		<div
			class="absolute inset-0 grid place-items-center bg-linear-to-br from-[oklch(0.5_0.14_var(--h)/0.55)] to-base-300"
			aria-hidden="true"
		>
			<span class={['font-black text-base-content/70', featured ? 'text-7xl' : 'text-5xl']}
				>{initials}</span
			>
		</div>
	{/if}

	<div
		class="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent"
		aria-hidden="true"
	></div>

	{#if rank}
		<span
			class="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-xs font-black text-white backdrop-blur"
			aria-label="Место {rank}">{rank}</span
		>
	{/if}
	{#if role}
		<span
			class="absolute top-2 left-2 rounded-full bg-[oklch(0.3_0.08_var(--h)/0.75)] px-2 py-0.5 text-[11px] font-semibold text-[oklch(0.92_0.08_var(--h))] backdrop-blur"
			>{roleLabel(role)}</span
		>
	{/if}

	<div class="absolute inset-x-0 bottom-0 p-3 text-white">
		<span
			class={[
				'block leading-tight font-bold text-balance drop-shadow',
				featured ? 'text-lg sm:text-xl' : 'line-clamp-2 text-sm'
			]}>{name}</span
		>
		{#if showOriginal}
			<span class="mt-0.5 block truncate text-xs text-white/60">{showOriginal}</span>
		{/if}
	</div>
</a>
