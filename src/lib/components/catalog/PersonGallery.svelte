<script lang="ts">
	import PersonAvatar from './PersonAvatar.svelte';

	// Фото человека: на странице — одно крупным квадратом с пометкой «⤢ 7» (сколько всего) (видно, что оно
	// открывается и сколько их). Клик открывает просмотр на весь экран: там клик по фото, стрелки
	// ← → или кнопки листают по кругу, Esc или клик по фону закрывают.
	let {
		name,
		photoUrl,
		photos = []
	}: {
		name: string;
		photoUrl?: string | null;
		photos?: { url: string }[];
	} = $props();

	const urls = $derived(photos.length ? photos.map((p) => p.url) : photoUrl ? [photoUrl] : []);
	let index = $state(0);
	let dialog = $state<HTMLDialogElement>();
	const current = $derived(urls[Math.min(index, urls.length - 1)]);

	$effect(() => {
		void urls;
		index = 0;
	});

	const step = (d: number) => (index = (index + d + urls.length) % urls.length);

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') step(1);
		else if (e.key === 'ArrowLeft') step(-1);
	}
</script>

<div class="relative w-40 shrink-0 sm:w-48">
	{#if current}
		<button
			type="button"
			class="group relative block w-full cursor-zoom-in rounded-box focus-visible:outline-2 focus-visible:outline-primary"
			aria-label="Открыть фото{urls.length > 1 ? ` (всего ${urls.length})` : ''}"
			onclick={() => {
				index = 0;
				dialog?.showModal();
			}}
		>
			<PersonAvatar {name} photoUrl={urls[0]} size="lg" />
			<span
				class="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-xs font-semibold text-white backdrop-blur transition group-hover:bg-black/80"
				aria-hidden="true"
			>
				⤢{#if urls.length > 1}<span class="tabular-nums">{urls.length}</span>{/if}
			</span>
		</button>
	{:else}
		<PersonAvatar {name} size="lg" />
	{/if}
</div>

<dialog
	bind:this={dialog}
	class="m-auto max-h-[96vh] max-w-[98vw] overflow-visible bg-transparent p-0 backdrop:bg-black/85"
	{onkeydown}
	onclick={(e) => e.target === dialog && dialog?.close()}
>
	{#if current}
		<!-- Кнопки — по бокам от фото, а не поверх него: лицо ничем не закрыто. -->
		<div class="flex flex-col items-center gap-2">
			<div class="flex w-full justify-end">
				<button
					type="button"
					class="btn btn-circle bg-black/60 text-white btn-sm"
					aria-label="Закрыть"
					onclick={() => dialog?.close()}>✕</button
				>
			</div>
			<div class="flex items-center gap-2 sm:gap-4">
				{#if urls.length > 1}
					<button
						type="button"
						class="btn btn-circle shrink-0 bg-black/60 text-white"
						aria-label="Назад"
						onclick={() => step(-1)}>‹</button
					>
				{/if}
				<button
					type="button"
					class={['block', urls.length > 1 ? 'cursor-pointer' : 'cursor-default']}
					aria-label={urls.length > 1 ? 'Следующее фото' : name}
					onclick={() => urls.length > 1 && step(1)}
				>
					<img
						src={current}
						alt={name}
						class="max-h-[80vh] max-w-[calc(98vw-7rem)] rounded-box object-contain"
					/>
				</button>
				{#if urls.length > 1}
					<button
						type="button"
						class="btn btn-circle shrink-0 bg-black/60 text-white"
						aria-label="Дальше"
						onclick={() => step(1)}>›</button
					>
				{/if}
			</div>
			{#if urls.length > 1}
				<p class="rounded-full bg-black/60 px-3 py-1 text-xs text-white tabular-nums">
					{index + 1} / {urls.length}
				</p>
			{/if}
		</div>
	{/if}
</dialog>
