<script lang="ts">
	import { goto } from '$app/navigation';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntityKind, SchemaEntitySummary } from '#lib/api/generated/catalog.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { entityHref } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';
	import Poster from './Poster.svelte';

	// Поле поиска по названию с подсказками: через 250 мс после ввода — до 6 фильмов из Meilisearch
	// (мини-постер, название, год). Подсказка — ссылка на карточку: клик или стрелки + Enter
	// открывают фильм. Enter без выбранной подсказки — обычная отправка формы (поиск). Поле —
	// name="q" внутри формы родителя.
	let {
		value = '',
		placeholder,
		label,
		kind,
		class: inputClass = 'input w-full',
		listClass = 'w-full'
	}: {
		value?: string;
		placeholder: string;
		label: string;
		/** Только этот тип (раздел /films). */
		kind?: SchemaEntityKind;
		/** Классы поля (input-sm, input-lg …). */
		class?: string;
		/** Ширина и выравнивание списка подсказок. */
		listClass?: string;
	} = $props();

	const LIMIT = 6;
	const id = $props.id();
	let text = $derived(value);
	let items = $state<SchemaEntitySummary[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let request = 0;

	function suggest() {
		clearTimeout(timer);
		const q = text.trim();
		if (q.length < 2) {
			items = [];
			open = false;
			return;
		}
		timer = setTimeout(async () => {
			const n = ++request;
			try {
				const page = await unwrap(
					guestApi.catalog.GET('/api/v1/catalog/search', {
						params: { query: { q, kind, limit: LIMIT } }
					})
				);
				if (n !== request) return;
				items = page.items;
				active = -1;
				open = items.length > 0;
			} catch {
				// Поиск недоступен — без подсказок; отправка формы всё равно работает.
				if (n === request) open = false;
			}
		}, 250);
	}

	function onkeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			// По кругу через «ничего не выбрано» (-1): тогда Enter — обычный поиск.
			if (e.key === 'ArrowDown') active = active + 1 >= items.length ? -1 : active + 1;
			else active = active - 1 < -1 ? items.length - 1 : active - 1;
		} else if (e.key === 'Enter' && items[active]) {
			e.preventDefault();
			open = false;
			goto(entityHref(items[active]));
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="relative w-full">
	<input
		type="search"
		name="q"
		role="combobox"
		autocomplete="off"
		aria-label={label}
		aria-expanded={open}
		aria-controls="{id}-list"
		aria-autocomplete="list"
		aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
		{placeholder}
		class={inputClass}
		bind:value={text}
		oninput={suggest}
		onfocus={() => items.length && text.trim().length >= 2 && (open = true)}
		onblur={() => (open = false)}
		{onkeydown}
	/>
	{#if open}
		<ul
			id="{id}-list"
			role="listbox"
			aria-label="Подсказки: {label}"
			class={[
				'absolute z-40 mt-1 overflow-hidden rounded-box bg-base-100 p-1 shadow-xl ring-1 ring-base-300',
				listClass
			]}
		>
			{#each items as entity, i (entity.id)}
				<li id="{id}-{i}" role="option" aria-selected={i === active}>
					<!-- mousedown не забирает фокус: иначе blur закрыл бы список раньше перехода. -->
					<a
						href={entityHref(entity)}
						class={[
							'flex items-center gap-3 rounded-field px-2 py-1.5 text-sm',
							i === active ? 'bg-base-200' : 'hover:bg-base-200'
						]}
						onmousedown={(e) => e.preventDefault()}
						onclick={() => (open = false)}
						onmouseenter={() => (active = i)}
					>
						<span class="w-8 shrink-0">
							<Poster title={entity.title} kind={entity.kind} coverUrl={entity.cover_url} small />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{entity.title}</span>
							{#if yearOf(entity.release_date)}
								<span class="block text-xs text-base-content/50">{yearOf(entity.release_date)}</span
								>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
