<script lang="ts">
	import { page } from '$app/state';
	import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { useRealtime } from '#lib/realtime/realtime.svelte.ts';
	import { loginUrl } from '#lib/utils/redirect.ts';

	// «Следить» — сущность в интересах: её темы и рецензии попадают в ленту и приходят вживую.
	// Изменили на другом устройстве или вкладке — interest.added / interest.removed в user:me.
	let { slug, entityId }: { slug: string; entityId: string } = $props();

	let watching = $state<boolean | null>(null);
	let busy = $state(false);
	let error = $state('');
	const path = $derived({ slug });

	$effect(() => {
		watching = null;
		error = '';
		if (session.status !== 'authed') return;
		const current = slug;
		unwrap(
			api.social.GET('/api/v1/social/entities/{slug}/interest', {
				params: { path: { slug: current } }
			})
		)
			.then(() => current === slug && (watching = true))
			.catch((e) => {
				if (current !== slug) return;
				if (e instanceof ApiError && e.status === 404) watching = false;
				else error = errorMessage(e);
			});
	});

	useRealtime(
		() => (session.status === 'authed' ? ['user:me'] : []),
		(event) => {
			if (event.data.entity_id !== entityId) return;
			if (event.event === 'interest.added') watching = true;
			if (event.event === 'interest.removed') watching = false;
		}
	);

	async function toggle() {
		const next = !watching;
		busy = true;
		error = '';
		try {
			await unwrap(
				next
					? api.social.PUT('/api/v1/social/entities/{slug}/interest', { params: { path } })
					: api.social.DELETE('/api/v1/social/entities/{slug}/interest', { params: { path } })
			);
			watching = next;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if session.status === 'guest'}
	<a href={loginUrl(page.url)} class="btn btn-lg">🔔 Следить</a>
{:else if session.status === 'authed' && watching !== null}
	<button
		class={['btn btn-lg', { 'btn-outline btn-primary': watching }]}
		aria-pressed={watching}
		disabled={busy}
		onclick={toggle}
		title={watching
			? 'Темы и рецензии приходят в ленту'
			: 'Темы и рецензии будут приходить в ленту'}
	>
		{watching ? '🔔 Вы следите' : '🔔 Следить'}
	</button>
{/if}
{#if error}<span role="alert" class="self-center text-sm text-error">{error}</span>{/if}
