<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		JOURNAL_KINDS,
		type JournalFilter,
		type JournalKind
	} from '#lib/social/journal.ts';

	// Состояние фильтров живёт в адресе (?filter=&kind=&q=): так работает возврат с карточки.
	let {
		filter,
		kind,
		q,
		isOwner
	}: {
		filter: JournalFilter;
		kind: JournalKind | undefined;
		q: string | undefined;
		isOwner: boolean;
	} = $props();

	let text = $state('');
	$effect(() => {
		text = q ?? '';
	});

	function go(set: { filter?: JournalFilter; kind?: JournalKind | null; q?: string }) {
		const url = new URL(page.url.href);
		const apply = (key: string, value: string | null | undefined, empty: string | null) => {
			if (value === undefined) return;
			if (value === null || value === empty || value === '') url.searchParams.delete(key);
			else url.searchParams.set(key, value);
		};
		apply('filter', set.filter, 'all');
		apply('kind', set.kind, null);
		apply('q', set.q, '');
		goto(url, { replace: true, reset: false });
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(() => go({ q: text.trim() }), 300);
	}
</script>

<div class="mb-4 flex flex-col gap-3 rounded-box bg-base-200 p-3 ring-1 ring-base-300">

	<div class="flex flex-wrap items-center justify-between gap-3">
		<nav class="tabs-box tabs w-fit tabs-xs" aria-label="Тип произведения">
			<button
				class={['tab', { 'tab-active': !kind }]}
				aria-pressed={!kind}
				onclick={() => go({ kind: null })}>Все</button
			>
			{#each JOURNAL_KINDS as k (k.value)}
				<button
					class={['tab', { 'tab-active': k.value === kind }]}
					aria-pressed={k.value === kind}
					onclick={() => go({ kind: k.value === kind ? null : k.value })}>{k.title}</button
				>
			{/each}
		</nav>
		<input
			type="search"
			class="input input-sm min-w-0 flex-1 sm:max-w-sm"
			placeholder="Поиск по названию"
			aria-label="Поиск по названию"
			bind:value={text}
			oninput={onInput}
		/>
	</div>
</div>
