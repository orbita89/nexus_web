<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { entityHref, asKind } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import EmptyState from '#lib/components/catalog/EmptyState.svelte';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import Markdown from '#lib/components/social/Markdown.svelte';
	import TimeAgo from '#lib/components/social/TimeAgo.svelte';
	import {
		listMyNotes,
		listMyPersonNotes,
		type NoteWithEntity,
		type NoteWithPerson
	} from '#lib/social/notes.ts';

	// Свои заметки о произведениях: у бэкенда есть только /users/me/notes — чужих заметок не
	// существует как маршрута. Поэтому страница живёт в браузере, с токеном, и открывается
	// только владельцу; гостю и чужому — «страница не для вас», а не пустой список.
	const PAGE = 20;
	const username = $derived(page.params.username);
	const mine = $derived(session.status === 'authed' && session.user?.username === username);

	// Заметки о людях подгружаем отдельным списком (kind=person) и показываем в общей ленте по дате.
	let items = $state<NoteWithEntity[]>([]);
	let people = $state<NoteWithPerson[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state('');

	$effect(() => {
		if (!mine) {
			loading = session.status === 'loading';
			return;
		}
		let stale = false;
		loading = true;
		Promise.all([listMyNotes(api, { limit: PAGE }), listMyPersonNotes(api, { limit: PAGE })])
			.then(([p, pp]) => {
				if (stale) return;
				items = p.items;
				people = pp.items;
				total = p.total + pp.total;
			})
			.catch((e) => !stale && (error = errorMessage(e)))
			.finally(() => !stale && (loading = false));
		return () => {
			stale = true;
		};
	});

	async function more() {
		try {
			const [next, nextPeople] = await Promise.all([
				listMyNotes(api, { limit: PAGE, offset: items.length }),
				listMyPersonNotes(api, { limit: PAGE, offset: people.length })
			]);
			items = [...items, ...next.items];
			people = [...people, ...nextPeople.items];
			total = next.total + nextPeople.total;
		} catch (e) {
			error = errorMessage(e);
		}
	}

	const feed = $derived(
		[
			...items.map((n) => ({ ...n, person: undefined as NoteWithPerson['person'] | undefined })),
			...people.map((n) => ({ ...n, entity: undefined as NoteWithEntity['entity'] | undefined }))
		].toSorted((a, b) => b.updated_at.localeCompare(a.updated_at))
	);
</script>

<Seo title="Заметки" noindex />

{#if !mine && !loading}
	<EmptyState title="Заметки видны только их автору"
		>Это личные записи: ни другие люди, ни администрация их не читают.</EmptyState
	>
{:else if error}
	<LoadError message={error} />
{:else if loading}
	<div class="h-40 animate-pulse rounded-box bg-base-200" aria-hidden="true"></div>
{:else if feed.length}
	<p class="mb-4 text-sm text-base-content/50">
		{total.toLocaleString('ru-RU')} — видно только вам
	</p>
	<ul class="flex flex-col gap-3" aria-label="Мои заметки">
		{#each feed as note (note.id)}
			{@const kind = note.entity ? asKind(note.entity.kind) : null}
			<li class="rounded-box bg-base-200 p-4 ring-1 ring-base-300">
				<div class="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
					{#if note.person}
						<a href="/people/{note.person.slug}" class="font-semibold hover:text-primary"
							>{note.person.full_name}
							<span class="font-normal text-base-content/45">(человек)</span></a
						>
					{:else if note.entity && kind}
						<a
							href={entityHref({ kind, slug: note.entity.slug })}
							class="font-semibold hover:text-primary"
						>
							{note.entity.title}
							{#if yearOf(note.entity.release_date)}
								<span class="font-normal text-base-content/45"
									>({yearOf(note.entity.release_date)})</span
								>
							{/if}
						</a>
					{:else}
						<span class="font-semibold">{note.entity?.title}</span>
					{/if}
					<span class="text-xs text-base-content/40"><TimeAgo iso={note.updated_at} /></span>
				</div>
				<Markdown text={note.body} class="text-sm text-base-content/80" />
			</li>
		{/each}
	</ul>
	{#if items.length + people.length < total}
		<button class="btn mt-4 btn-ghost btn-sm" onclick={more}>Показать ещё</button>
	{/if}
{:else}
	<EmptyState title="Заметок пока нет"
		>Заметка пишется на карточке произведения — её не видит никто, кроме вас.</EmptyState
	>
{/if}
