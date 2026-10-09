<script lang="ts">
	// Быстрые реакции вместо графиков: 🔥 😢 🤔 😴, одна на зрителя, повторный клик снимает.
	// API реакций ещё нет (docs/backend-questions.md): пока выбор хранится в браузере, счётчиков
	// нет. Когда появится — value и onchange придут сверху, а счётчики — в counts.
	let {
		slug,
		counts
	}: {
		slug: string;
		/** Сколько каждой реакции; нет — без чисел. */
		counts?: Partial<Record<Reaction, number>>;
	} = $props();

	type Reaction = (typeof REACTIONS)[number]['key'];
	const REACTIONS = [
		{ key: 'fire', emoji: '🔥', label: 'Огонь' },
		{ key: 'sad', emoji: '😢', label: 'Грустно' },
		{ key: 'think', emoji: '🤔', label: 'Заставляет думать' },
		{ key: 'bored', emoji: '😴', label: 'Скучно' }
	] as const;

	const storageKey = $derived(`nexus.reaction.${slug}`);
	let mine = $state<Reaction | null>(null);

	$effect(() => {
		try {
			mine = (localStorage.getItem(storageKey) as Reaction | null) ?? null;
		} catch {
			mine = null;
		}
	});

	function pick(key: Reaction) {
		mine = mine === key ? null : key;
		try {
			if (mine) localStorage.setItem(storageKey, mine);
			else localStorage.removeItem(storageKey);
		} catch {
			// приватный режим — просто не запоминаем
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
			onclick={() => pick(r.key)}
		>
			<span class="text-lg leading-none transition-transform active:scale-125">{r.emoji}</span>
			{#if counts?.[r.key]}<span class="text-xs tabular-nums">{counts[r.key]}</span>{/if}
		</button>
	{/each}
</div>
