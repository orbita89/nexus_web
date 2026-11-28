<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { count } from '#lib/catalog/labels.ts';
	import { HERO_GLASS as GLASS } from '#lib/components/card/buttons.ts';
	import { me } from '#lib/social/me.svelte.ts';
	import { formatRating } from '#lib/social/reviews.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// Оценка человеку 1–10: «как я оцениваю этого режиссёра / актёра». Средняя и число оценок —
	// из статической страницы (PersonDetail.rating; после оценки бэкенд её перерисовывает), своя —
	// из снимка «моего» (me.svelte.ts). Ни одного запроса при открытии страницы.
	let {
		slug,
		average,
		total
	}: { slug: string; average: number | null | undefined; total: number } = $props();

	/** Сводка после своей оценки — ответ PUT/DELETE; до этого — со страницы. */
	let fresh = $state<{ average?: number | null; count: number } | null>(null);
	let open = $state(false);
	let busy = $state(false);
	let error = $state('');
	let details = $state<HTMLDetailsElement>();

	$effect(() => {
		void slug;
		fresh = null;
		error = '';
	});

	const mine = $derived(session.status === 'authed' ? (me.person(slug).rating ?? null) : null);
	const avg = $derived(fresh ? (fresh.average ?? null) : (average ?? null));
	const votes = $derived(fresh ? fresh.count : total);

	async function rate(n: number | null) {
		if (busy) return;
		const before = mine;
		me.patchPerson(slug, { rating: n ?? undefined });
		busy = true;
		error = '';
		const params = { path: { slug } };
		try {
			fresh = await unwrap(
				n
					? api.social.PUT('/api/v1/social/people/{slug}/rating', { params, body: { rating: n } })
					: api.social.DELETE('/api/v1/social/people/{slug}/rating', { params })
			);
			open = false;
		} catch (e) {
			me.patchPerson(slug, { rating: before ?? undefined });
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	function onWindowClick(event: MouseEvent) {
		if (open && details && !details.contains(event.target as Node)) open = false;
	}
</script>

<svelte:window
	onclick={onWindowClick}
	onkeydown={(e) => open && e.key === 'Escape' && (open = false)}
/>

{#snippet star(filled: boolean)}
	<svg
		class="size-4"
		viewBox="0 0 24 24"
		fill={filled ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linejoin="round"
		aria-hidden="true"
		><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg
	>
{/snippet}

<div class="flex items-center gap-3">
	{#if avg != null}
		<span
			class="flex items-center gap-2 border-r border-base-content/15 pr-4"
			aria-label="Средняя оценка {formatRating(avg, { average: true })} из 10, {count(votes, [
				'оценка',
				'оценки',
				'оценок'
			])}"
		>
			<span class="text-primary">{@render star(true)}</span>
			<span class="flex flex-col leading-none">
				<span class="text-2xl font-black tabular-nums">{formatRating(avg, { average: true })}</span>
				<span class="mt-0.5 text-[0.7rem] text-base-content/50"
					>{count(votes, ['оценка', 'оценки', 'оценок'])}</span
				>
			</span>
		</span>
	{/if}

	{#if session.status === 'guest'}
		<a href={loginUrl(page.url)} class={GLASS}>{@render star(false)} Оценить</a>
	{:else if session.status === 'loading' || !me.ready}
		<span class="h-10 w-28 skeleton rounded-full" aria-hidden="true"></span>
	{:else}
		<details bind:this={details} bind:open class="dropdown dropdown-bottom">
			<summary class={[GLASS, 'list-none']}>
				{@render star(mine != null)}
				{#if mine != null}
					<span class="font-medium opacity-80">Ваша</span>
					<span class="font-black tabular-nums">{mine}</span>
				{:else}
					Оценить
				{/if}
			</summary>
			<div
				class="dropdown-content z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-box bg-base-200 p-4 shadow-xl ring-1 ring-base-300"
			>
				<h2 class="text-xs font-semibold tracking-widest text-base-content/50 uppercase">
					Ваша оценка
				</h2>
				<div class="mt-2 grid grid-cols-10 gap-1" role="group" aria-label="Ваша оценка от 1 до 10">
					{#each { length: 10 }, i (i)}
						{@const n = i + 1}
						{@const active = mine === n}
						<button
							class={[
								'btn h-9 min-h-0 px-0 font-bold tabular-nums btn-sm',
								active
									? 'btn-primary'
									: 'border-transparent bg-base-300 hover:border-primary/40 hover:bg-primary/15 hover:text-primary'
							]}
							aria-pressed={active}
							aria-label="Оценка {n}"
							disabled={busy}
							onclick={() => rate(n)}>{n}</button
						>
					{/each}
				</div>
				{#if mine != null}
					<button
						class="mt-3 link text-sm text-base-content/60 link-hover"
						disabled={busy}
						onclick={() => rate(null)}>Снять оценку</button
					>
				{/if}
				{#if error}<p role="alert" class="mt-2 text-sm text-error">{error}</p>{/if}
			</div>
		</details>
	{/if}
</div>
