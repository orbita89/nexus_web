<script lang="ts" module>
	export interface Suggestion {
		value: string;
		label: string;
		/** Справа серым: «12 фильмов», год рождения. */
		hint?: string;
		/** Раздел списка («Жанры», «Теги»): заголовок — перед первым элементом раздела. */
		group?: string;
	}
</script>

<script lang="ts">
	// Поле с подсказками (combobox): ввод → через 250 мс load(q) → список; стрелки, Enter, Esc,
	// мышь. Выбор — onselect, поле очищается: выбранное показывает плашка фильтра. minLength = 0 —
	// выпадающий список: открывается по клику (load('')), ввод его сужает.
	let {
		label,
		placeholder,
		load,
		onselect,
		minLength = 1
	}: {
		label: string;
		placeholder: string;
		load: (q: string) => Promise<Suggestion[]>;
		onselect: (s: Suggestion) => void;
		/** С какой длины запроса искать; 0 — показывать подсказки и по пустому полю. */
		minLength?: number;
	} = $props();

	const id = $props.id();
	let text = $state('');
	let items = $state<Suggestion[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let loading = $state(false);
	let failed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let request = 0;

	function fetchSoon(delay = 250) {
		clearTimeout(timer);
		const q = text.trim();
		if (q.length < minLength) {
			items = [];
			open = false;
			return;
		}
		timer = setTimeout(async () => {
			const n = ++request;
			loading = true;
			try {
				const found = await load(q);
				if (n !== request) return;
				items = found;
				failed = false;
				active = found.length ? 0 : -1;
				open = true;
			} catch {
				if (n !== request) return;
				items = [];
				failed = open = true;
			} finally {
				if (n === request) loading = false;
			}
		}, delay);
	}

	function choose(s: Suggestion) {
		onselect(s);
		text = '';
		items = [];
		open = false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) return fetchSoon(0);
			const step = e.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + items.length) % Math.max(items.length, 1);
		} else if (e.key === 'Enter' && open && items[active]) {
			e.preventDefault();
			choose(items[active]);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="relative">
	<label class="input w-full">
		<span class="sr-only">{label}</span>
		<input
			type="text"
			role="combobox"
			autocomplete="off"
			aria-label={label}
			aria-expanded={open}
			aria-controls="{id}-list"
			aria-autocomplete="list"
			aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
			{placeholder}
			bind:value={text}
			oninput={() => fetchSoon()}
			onfocus={() => minLength === 0 && fetchSoon(0)}
			onclick={() => minLength === 0 && !open && fetchSoon(0)}
			onblur={() => (open = false)}
			{onkeydown}
		/>
		{#if loading}<span class="loading loading-xs loading-spinner opacity-50"></span>
		{:else if minLength === 0}<svg
				class="size-4 opacity-40"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
			>{/if}
	</label>
	{#if open}
		<ul
			id="{id}-list"
			role="listbox"
			aria-label={label}
			class="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-box bg-base-100 p-1 shadow-xl ring-1 ring-base-300"
		>
			{#each items as item, i (item.value)}
				{#if item.group && item.group !== items[i - 1]?.group}
					<li
						role="presentation"
						class="px-3 pt-2 pb-1 text-xs font-semibold tracking-widest text-base-content/40 uppercase"
					>
						{item.group}
					</li>
				{/if}
				<!-- mousedown, а не click: иначе blur закроет список раньше выбора. -->
				<li
					id="{id}-{i}"
					role="option"
					aria-selected={i === active}
					class={[
						'flex cursor-pointer items-baseline justify-between gap-3 rounded-field px-3 py-2 text-sm',
						{ 'bg-base-200': i === active }
					]}
					onmousedown={(e) => {
						e.preventDefault();
						choose(item);
					}}
					onmouseenter={() => (active = i)}
				>
					<span class="truncate">{item.label}</span>
					{#if item.hint}<span class="shrink-0 text-xs text-base-content/40">{item.hint}</span>{/if}
				</li>
			{:else}
				<li class="px-3 py-2 text-sm text-base-content/50">
					{failed ? 'Подсказки сейчас недоступны' : 'Ничего не нашлось'}
				</li>
			{/each}
		</ul>
	{/if}
</div>
