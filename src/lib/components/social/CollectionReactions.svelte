<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { browserApi } from '#lib/social/card-live.svelte.ts';
	import {
		applyReaction,
		REACTIONS,
		type Reaction,
		type ReactionCounts
	} from '#lib/social/reactions.ts';

	// Реакции на подборку: 🔥 😢 🤔 😴, одна на зрителя — другая заменяет, повторный клик снимает
	// (та же механика, что у реакций на произведение, applyReaction).
	//
	// Сводка и своя реакция приходят одним запросом: GET …/collections/{id}/reactions отдаёт и
	// счётчики, и mine. Гостю он тоже отвечает — просто с mine: null.
	let { collectionId }: { collectionId: string } = $props();

	const ZERO: ReactionCounts = { fire: 0, sad: 0, think: 0, bored: 0 };

	let counts = $state<ReactionCounts | null>(null);
	let mine = $state<Reaction | null>(null);
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		const id = collectionId;
		counts = null;
		mine = null;
		error = '';
		if (session.status === 'loading') return;
		// С токеном — чтобы в mine пришла своя реакция; гостю хватает публичного клиента.
		const client = session.status === 'authed' ? api : browserApi();
		let stale = false;
		unwrap(
			client.social.GET('/api/v1/social/collections/{id}/reactions', { params: { path: { id } } })
		)
			.then((result) => {
				if (stale) return;
				counts = result.reactions;
				mine = result.mine ?? null;
			})
			.catch((e) => !stale && (error = errorMessage(e)));
		return () => {
			stale = true;
		};
	});

	async function pick(key: Reaction) {
		if (busy) return;
		const before = { counts, mine };
		const next = applyReaction(counts ?? ZERO, mine, key);
		counts = next.counts;
		mine = next.mine;
		busy = true;
		error = '';
		const params = { path: { id: collectionId } };
		try {
			if (next.mine) {
				await unwrap(
					api.social.PUT('/api/v1/social/collections/{id}/reaction', {
						params,
						body: { kind: next.mine }
					})
				);
			} else {
				await unwrap(api.social.DELETE('/api/v1/social/collections/{id}/reaction', { params }));
			}
		} catch (e) {
			counts = before.counts;
			mine = before.mine;
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-wrap gap-1.5" role="group" aria-label="Реакции на подборку">
	{#each REACTIONS as r (r.key)}
		<button
			class={[
				'btn h-9 min-h-0 gap-1.5 rounded-full px-3 btn-sm',
				mine === r.key ? 'border-primary/60 bg-primary/15' : 'border-base-300 bg-base-100 btn-ghost'
			]}
			aria-pressed={mine === r.key}
			aria-label={r.label}
			title={r.label}
			disabled={session.status !== 'authed' || busy}
			onclick={() => pick(r.key)}
		>
			<span class="text-lg leading-none transition-transform active:scale-125">{r.emoji}</span>
			{#if counts?.[r.key]}<span class="text-xs tabular-nums">{counts[r.key]}</span>{/if}
		</button>
	{/each}
</div>
{#if error}<p role="alert" class="mt-2 text-sm text-error">{error}</p>{/if}
