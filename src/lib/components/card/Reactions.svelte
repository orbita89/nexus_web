<script lang="ts">
	import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import {
		applyReaction,
		REACTIONS,
		type Reaction,
		type ReactionCounts
	} from '#lib/social/reactions.ts';

	// Быстрые реакции вместо графиков: 🔥 😢 🤔 😴, одна на зрителя: другая заменяет, повторный
	// клик снимает. Числа — из сводки оценок (counts), своя — отдельным запросом с токеном. Нажатие
	// меняет числа сразу; ошибка (в т. ч. 409 до премьеры) — откат и сообщение.
	let {
		slug,
		counts,
		released = true
	}: {
		slug: string;
		/** Из RatingSummary.reactions; ещё не загрузились — без чисел. */
		counts?: ReactionCounts;
		released?: boolean;
	} = $props();

	const ZERO: ReactionCounts = { fire: 0, sad: 0, think: 0, bored: 0 };
	// Числа — из сводки; после своего нажатия — свои, пока сводку не перечитали.
	let shown = $derived(counts);
	let mine = $state<Reaction | null>(null);
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		const current = slug;
		mine = null;
		error = '';
		if (session.status !== 'authed') return;
		let stale = false;
		unwrap(
			api.social.GET('/api/v1/social/entities/{slug}/reaction', {
				params: { path: { slug: current } }
			})
		)
			.then((r) => !stale && (mine = r.kind))
			.catch((e) => {
				if (!stale && !(e instanceof ApiError && e.status === 404)) error = errorMessage(e);
			});
		return () => {
			stale = true;
		};
	});

	async function pick(key: Reaction) {
		if (busy) return;
		const before = { counts: shown, mine };
		const next = applyReaction(shown ?? ZERO, mine, key);
		if (shown) shown = next.counts;
		mine = next.mine;
		busy = true;
		error = '';
		const params = { path: { slug } };
		try {
			if (next.mine) {
				await unwrap(
					api.social.PUT('/api/v1/social/entities/{slug}/reaction', {
						params,
						body: { kind: next.mine }
					})
				);
			} else {
				await unwrap(api.social.DELETE('/api/v1/social/entities/{slug}/reaction', { params }));
			}
		} catch (e) {
			shown = before.counts;
			mine = before.mine;
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-wrap gap-1.5" role="group" aria-label="Реакции">
	{#each REACTIONS as r (r.key)}
		<button
			class={[
				'btn h-9 min-h-0 gap-1.5 rounded-full px-3 btn-sm',
				mine === r.key ? 'border-primary/60 bg-primary/15' : 'border-base-300 bg-base-100 btn-ghost'
			]}
			aria-pressed={mine === r.key}
			aria-label={r.label}
			title={r.label}
			disabled={!released || session.status !== 'authed'}
			onclick={() => pick(r.key)}
		>
			<span class="text-lg leading-none transition-transform active:scale-125">{r.emoji}</span>
			{#if shown?.[r.key]}<span class="text-xs tabular-nums">{shown[r.key]}</span>{/if}
		</button>
	{/each}
</div>
{#if error}<p role="alert" class="mt-2 text-sm text-error">{error}</p>{/if}
