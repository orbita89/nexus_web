<script lang="ts">
	import { goto } from '$app/navigation';
	import { unwrap } from '#lib/api/errors.ts';
	import type { SchemaEntitySummary, SchemaPersonHit } from '#lib/api/generated/catalog.ts';
	import { guestApi } from '#lib/auth/session.svelte.ts';
	import { entityHref, KINDS, kindByApi } from '#lib/catalog/kinds.ts';
	import { yearOf } from '#lib/catalog/labels.ts';

	// Поиск на главной: чипы под полем — не ссылки на разделы (они и так есть в шапке), а область
	// поиска, и подсказки приходят прямо на наборе — до того, как человек нажал «Найти».
	// Только Meilisearch: в GET /entities поиска по названию нет.
	// Отдельного «Везде» нет: ничего не выбрано — ищем везде, повторный клик снимает выбор.
	const SCOPES = [
		...KINDS.map((k) => ({ id: k.slug, title: k.title })),
		{ id: 'people', title: 'Люди' }
	];
	const SHOWN = 6;

	type Hit =
		| { type: 'entity'; href: string; title: string; note: string; image?: string | null }
		| { type: 'person'; href: string; title: string; note: string; image?: string | null };

	/** Пусто — везде (произведения + пара людей). */
	let scope = $state('');
	let query = $state('');
	let hits = $state<Hit[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let box: HTMLDivElement;

	const kind = $derived(KINDS.find((k) => k.slug === scope)?.kind);
	/** Куда ведёт «Найти»: люди живут на своей странице, остальное — на общей выдаче. */
	const action = $derived(scope === 'people' ? '/people' : '/search');

	async function entities(q: string): Promise<Hit[]> {
		const params = { query: { q, kind, limit: SHOWN } };
		const found = await unwrap(guestApi.catalog.GET('/api/v1/catalog/search', { params }));
		return found.items.map((e: SchemaEntitySummary) => ({
			type: 'entity' as const,
			href: entityHref(e),
			title: e.title,
			note: [yearOf(e.release_date), kindByApi(e.kind).one].filter(Boolean).join(' · '),
			image: e.cover_url
		}));
	}

	async function people(q: string, limit: number): Promise<Hit[]> {
		const params = { query: { q, limit } };
		const found = await unwrap(guestApi.catalog.GET('/api/v1/catalog/search/people', { params }));
		return found.items.map((p: SchemaPersonHit) => ({
			type: 'person' as const,
			href: `/people/${p.slug}`,
			title: p.full_name,
			note: p.original_name ?? 'Человек',
			image: p.photo_url
		}));
	}

	function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		active = -1;
		if (q.length < 2) {
			hits = [];
			open = false;
			return;
		}
		timer = setTimeout(async () => {
			try {
				// «Везде» — произведения, а под ними пара людей: имя ищут не реже названия.
				const found =
					scope === 'people'
						? await people(q, SHOWN)
						: (await Promise.all([entities(q), scope ? [] : people(q, 2)])).flat();
				if (q !== query.trim()) return;
				hits = found.slice(0, SHOWN + 2);
				open = hits.length > 0;
			} catch {
				// Поиск недоступен — просто без подсказок: форма по-прежнему уводит на выдачу.
				hits = [];
				open = false;
			}
		}, 200);
	}

	function pick(scopeId: string) {
		scope = scope === scopeId ? '' : scopeId;
		if (query.trim().length >= 2) onInput();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			active = -1;
			return;
		}
		if (!open || !hits.length) return;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			// -1 — «ничего не выбрано»: по кругу возвращаемся к набранному тексту.
			if (e.key === 'ArrowDown') active = active + 1 >= hits.length ? -1 : active + 1;
			else active = active < 0 ? hits.length - 1 : active - 1;
		} else if (e.key === 'Enter' && active >= 0) {
			e.preventDefault();
			open = false;
			goto(hits[active].href);
		}
	}
</script>

<!-- Весь блок — один focus-группа: клик по подсказке не должен закрывать список раньше перехода. -->
<div
	class="relative max-w-xl"
	bind:this={box}
	onfocusout={(e) => {
		if (!box.contains(e.relatedTarget as Node | null)) open = false;
	}}
>
	<form
		{action}
		method="GET"
		role="search"
		class="flex items-center gap-2 rounded-full bg-base-100/40 p-2 pl-3 ring-1 ring-base-content/10 backdrop-blur-md focus-within:ring-2 focus-within:ring-primary/60"
	>
		{#if kind}<input type="hidden" name="kind" value={scope} />{/if}
		<input
			type="search"
			name="q"
			bind:value={query}
			oninput={onInput}
			onkeydown={onKey}
			onfocus={() => (open = hits.length > 0)}
			placeholder={scope === 'people' ? 'Нолан, Кинг, Миядзаки…' : 'Дюна, Кинг, киберпанк…'}
			aria-label="Найти в каталоге"
			role="combobox"
			aria-expanded={open}
			aria-controls="hero-suggestions"
			aria-autocomplete="list"
			autocomplete="off"
			class="input h-11 w-full border-0 bg-transparent text-base focus:outline-none"
		/>
		<button class="btn h-11 min-h-0 rounded-full px-6 btn-primary">Найти</button>
	</form>

	<!-- Чипы — область поиска, а не переход в раздел: выбранная подсвечена. -->
	<div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Где искать">
		{#each SCOPES as s (s.id)}
			<button
				type="button"
				aria-pressed={scope === s.id}
				onclick={() => pick(s.id)}
				class={[
					'btn h-8 min-h-0 rounded-full px-4 font-normal backdrop-blur-md btn-sm',
					scope === s.id
						? 'border-primary/60 bg-primary/15 text-primary'
						: 'border-base-content/10 bg-base-100/30 hover:border-primary/40 hover:text-primary'
				]}>{s.title}</button
			>
		{/each}
	</div>

	{#if open}
		<ul
			id="hero-suggestions"
			role="listbox"
			aria-label="Подсказки"
			class="absolute top-full right-0 left-0 z-20 mt-2 overflow-hidden rounded-box border border-base-300 bg-base-200/95 shadow-xl backdrop-blur-md"
		>
			{#each hits as hit, i (hit.href)}
				<li role="option" aria-selected={i === active}>
					<a
						href={hit.href}
						onmouseenter={() => (active = i)}
						class={[
							'flex items-center gap-3 px-3 py-2',
							i === active ? 'bg-base-content/10' : 'hover:bg-base-content/5'
						]}
					>
						<span
							class={[
								'shrink-0 overflow-hidden bg-base-300',
								hit.type === 'person' ? 'size-9 rounded-full' : 'h-12 w-8 rounded'
							]}
						>
							{#if hit.image}
								<img src={hit.image} alt="" loading="lazy" class="size-full object-cover" />
							{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-medium">{hit.title}</span>
							<span class="block truncate text-xs text-base-content/50">{hit.note}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
