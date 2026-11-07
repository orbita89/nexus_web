<script lang="ts" module>
	export interface Suggestion {
		value: string;
		label: string;
		/** Серым под названием: «12 фильмов», год рождения. */
		hint?: string;
		/** Раздел списка («Жанры», «Теги»): заголовок — перед первым элементом раздела. */
		group?: string;
		/** Значок слева: флаг страны. */
		emoji?: string;
		/** Круглое фото слева: человек. */
		photoUrl?: string | null;
		/** Логотип слева: студия, издатель, музей. */
		logoUrl?: string | null;
	}
</script>

<script lang="ts">
	// Фильтр-таблетка: кнопка с названием поля, под ней — панель с поиском и сеткой вариантов.
	// Панель — часть формы, а не всплывающее окно: она раскрывается под строкой таблеток и
	// раздвигает блок (order-1 опускает её под все кнопки строки, отрицательные поля растягивают
	// до краёв). Открыта всегда одна — её выбирает родитель (`open` + `ontoggle`).
	//
	// Пустого состояния у панели нет: по пустому запросу показываем самое частое — страны, с
	// которых начинают, известных людей. Пустая панель с «Начните вводить» выглядела недоделанной.
	import { untrack, type Snippet } from 'svelte';
	import PersonAvatar from './PersonAvatar.svelte';
	import StudioLogo from './StudioLogo.svelte';

	let {
		label,
		icon,
		load,
		onselect,
		searchPlaceholder = 'Поиск…',
		more,
		header,
		children,
		active = false,
		open = false,
		ontoggle,
		/** Смена этого значения перезапрашивает варианты: выбрана другая вкладка ролей. */
		reloadKey = ''
	}: {
		label: string;
		/** Значок слева от названия. */
		icon?: Snippet;
		/** Варианты по запросу; пустой запрос — что показать сразу. */
		load?: (q: string) => Promise<Suggestion[]>;
		onselect?: (s: Suggestion) => void;
		searchPlaceholder?: string;
		/** Ссылка «Все страны →» в углу панели: там же, но списком и целиком. */
		more?: { href: string; label: string };
		/** Над поиском: вкладки ролей у «Персоналий». */
		header?: Snippet;
		/** Содержимое вместо поиска с сеткой: поле года. */
		children?: Snippet;
		/** Фильтр выбран — таблетка подсвечена и в закрытом виде. */
		active?: boolean;
		open?: boolean;
		ontoggle?: (open: boolean) => void;
		reloadKey?: string;
	} = $props();

	const id = $props.id();
	let text = $state('');
	let items = $state<Suggestion[]>([]);
	let loading = $state(false);
	let failed = $state(false);
	let root = $state<HTMLElement>();
	let field = $state<HTMLInputElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let request = 0;

	async function fetchNow(q: string) {
		if (!load) return;
		const n = ++request;
		loading = true;
		try {
			const found = await load(q);
			if (n !== request) return;
			items = found;
			failed = false;
		} catch {
			if (n !== request) return;
			items = [];
			failed = true;
		} finally {
			if (n === request) loading = false;
		}
	}

	function fetchSoon() {
		clearTimeout(timer);
		const q = text.trim();
		timer = setTimeout(() => fetchNow(q), 250);
	}

	// Открыли панель или сменили вкладку роли — список перезапрашиваем. Введённое при этом не
	// отслеживаем (untrack): на каждую букву есть свой отложенный запрос.
	const reloadWhen = $derived(open ? reloadKey : null);
	$effect(() => {
		if (reloadWhen === null || !load) return;
		untrack(() => fetchNow(text.trim()));
	});

	function toggle() {
		if (open) return ontoggle?.(false);
		text = '';
		items = [];
		failed = false;
		ontoggle?.(true);
		// Фокус в поиск: открыли мышью — можно сразу печатать.
		queueMicrotask(() => field?.focus());
	}

	function close(focusPill = false) {
		clearTimeout(timer);
		ontoggle?.(false);
		if (focusPill) root?.querySelector('button')?.focus();
	}

	function choose(s: Suggestion) {
		onselect?.(s);
		close();
	}

	// Клик мимо и Esc закрывают панель: отдельной кнопки «Закрыть» нет — она лишняя там, где
	// закрывает любой щелчок в стороне и повторный клик по самой таблетке.
	function onpointerdown(e: PointerEvent) {
		if (open && root && !root.contains(e.target as Node)) close();
	}
	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') close(true);
	}

	/** Варианты по разделам («Жанры», «Теги»): заголовок — перед первым в разделе. */
	const groups = $derived.by(() => {
		const out: { group?: string; items: Suggestion[] }[] = [];
		for (const item of items) {
			const last = out.at(-1);
			if (last && last.group === item.group) last.items.push(item);
			else out.push({ group: item.group, items: [item] });
		}
		return out;
	});
</script>

<svelte:window {onpointerdown} {onkeydown} />

<div class="contents" bind:this={root}>
	<button
		type="button"
		class="filter-pill"
		class:filter-pill-on={open || active}
		aria-expanded={open}
		aria-controls={id}
		onclick={toggle}
	>
		{#if icon}<span class="shrink-0 opacity-70">{@render icon()}</span>{/if}
		<span class="truncate">{label}</span>
		<svg
			class="ml-auto size-3.5 shrink-0 opacity-60 transition-transform"
			class:rotate-180={open}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</button>

	{#if open}
		<div
			{id}
			class="order-1 -mx-3 mt-3 w-[calc(100%+1.5rem)] border-y border-base-content/10 bg-base-300/40 px-3 py-3 sm:-mx-4 sm:w-[calc(100%+2rem)] sm:px-4"
		>
			{#if children}
				{@render children()}
			{:else}
				<!-- Со вкладками поиск делит с ними строку и прижат вправо: в панели он не главный —
				     сначала смотрят сетку. Без вкладок делить строку не с кем, и поле занимает её
				     целиком: короткое поле у правого края оставляло пустой угол. -->
				<div
					class="mb-3 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4"
				>
					{#if header}{@render header()}{/if}
					<label
						class={[
							'filter-search w-full',
							header &&
								'sm:ml-auto sm:w-auto sm:min-w-60 sm:flex-1 sm:grow-0 lg:max-w-[32rem] lg:grow xl:max-w-none'
						]}
					>
						<svg
							class="size-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							aria-hidden="true"
						>
							<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
						</svg>
						<input
							bind:this={field}
							bind:value={text}
							oninput={fetchSoon}
							type="search"
							autocomplete="off"
							placeholder={searchPlaceholder}
							aria-label={searchPlaceholder}
						/>
					</label>
				</div>

				{#if loading && !items.length}
					<p class="px-1 py-6 text-center text-sm text-base-content/50">Ищем…</p>
				{:else if failed}
					<p class="px-1 py-6 text-center text-sm text-error">Поиск недоступен</p>
				{:else if !items.length}
					<p class="px-1 py-6 text-center text-sm text-base-content/50">Ничего не нашлось</p>
				{:else}
					<div class="max-h-80 overflow-y-auto">
						{#each groups as section, i (section.group ?? i)}
							{#if section.group}
								<p class="mt-2 mb-1 px-1 text-xs text-base-content/40 first:mt-0">
									{section.group}
								</p>
							{/if}
							<!-- Три колонки и на самом широком экране: девять вариантов ложатся ровно 3×3,
							     а четвёртая колонка оставляла последний ряд почти пустым. -->
							<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
								{#each section.items as item (item.value)}
									<button type="button" class="filter-card" onclick={() => choose(item)}>
										{#if item.photoUrl !== undefined}
											<PersonAvatar name={item.label} photoUrl={item.photoUrl} size="sm" />
										{:else if item.logoUrl}
											<StudioLogo url={item.logoUrl} />
										{:else if item.emoji}
											<span class="shrink-0 text-lg">{item.emoji}</span>
										{/if}
										<span class="min-w-0">
											<span class="block truncate font-medium">{item.label}</span>
											{#if item.hint}
												<span class="block truncate text-xs text-base-content/50">{item.hint}</span>
											{/if}
										</span>
									</button>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
				{#if more}
					<!-- «Все люди →» — в нижнем углу: это выход из панели, а не часть выбора, и
					     наверху он тянул внимание на себя. -->
					<p class="mt-2 text-right">
						<a href={more.href} class="link text-sm text-base-content/50 link-hover">
							{more.label} →
						</a>
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>
