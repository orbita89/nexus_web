<script lang="ts">
	import { TrailerPlayer } from '#lib/catalog/trailer-player.svelte.ts';
	import {
		embedUrl,
		sendCommand,
		sourceLabel,
		subscribe,
		type TrailerSource
	} from '#lib/catalog/trailer.ts';

	// Кнопка «Трейлер» и модалка с полноценным плеером (со звуком и управлением). iframe создаётся
	// при открытии и удаляется при закрытии: заранее ничего не грузится, при закрытии видео
	// останавливается. Источник выбирается в самом плеере (TrailerPlayer).
	let {
		sources,
		title,
		coverUrl,
		timeoutMs = 8000,
		onopen,
		onclose
	}: {
		sources: TrailerSource[];
		title: string;
		coverUrl?: string | null;
		/** Сколько ждать начала воспроизведения, прежде чем перейти к следующему источнику. */
		timeoutMs?: number;
		onopen?: () => void;
		onclose?: () => void;
	} = $props();

	const player = new TrailerPlayer(
		() => sources,
		() => timeoutMs
	);

	let dialog: HTMLDialogElement;
	let iframe = $state<HTMLIFrameElement>();
	let isOpen = $state(false);

	const src = $derived(isOpen ? embedUrl(player.current, location.origin) : '');

	function open() {
		isOpen = true;
		player.start();
		dialog.showModal();
		onopen?.();
	}

	let unsubscribe = () => {};

	function onClose() {
		isOpen = false;
		player.stop();
		unsubscribe();
		onclose?.();
	}

	function onMessage(event: MessageEvent) {
		if (!isOpen) return;
		// Плеер загрузился — просим играть (Rutube сам может не стартовать).
		if (player.handle(event, iframe) === 'loaded')
			sendCommand(iframe, player.current.provider, 'play');
	}

	function onFrameLoad() {
		unsubscribe();
		unsubscribe = subscribe(iframe, player.current.provider);
	}
</script>

<svelte:window onmessage={onMessage} />

<button class="btn gap-2 btn-lg btn-primary" onclick={open}>
	<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
		><path d="M8 5v14l11-7z" /></svg
	>
	Трейлер
</button>

<dialog bind:this={dialog} class="modal" aria-label="Трейлер: {title}" onclose={onClose}>
	<div class="modal-box w-full max-w-5xl bg-base-200 p-2 sm:w-11/12 sm:p-5">
		<div class="mb-3 flex items-center gap-3 pr-10">
			<h2 class="min-w-0 truncate font-bold">Трейлер: {title}</h2>
			{#if sources.length > 1}
				<div class="join ml-auto" role="group" aria-label="Источник">
					{#each sources as source, i (source.provider + source.id)}
						<button
							class={[
								'btn join-item btn-xs sm:btn-sm',
								{ 'btn-primary': i === player.index && !player.failed }
							]}
							aria-pressed={i === player.index && !player.failed}
							onclick={() => player.choose(i)}>{sourceLabel(sources, i)}</button
						>
					{/each}
				</div>
			{/if}
		</div>
		<form method="dialog">
			<button class="btn absolute top-3 right-3 btn-circle btn-ghost btn-sm" aria-label="Закрыть"
				>✕</button
			>
		</form>

		{#if player.notice}
			<p role="status" class="mb-2 text-sm text-warning">{player.notice}</p>
		{/if}

		<div class="aspect-video w-full overflow-hidden rounded-box bg-black">
			{#if isOpen && !player.failed}
				{#key src}
					<iframe
						bind:this={iframe}
						{src}
						title="Трейлер: {title}"
						class="h-full w-full"
						allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
						allowfullscreen
						referrerpolicy="strict-origin-when-cross-origin"
						onload={onFrameLoad}
					></iframe>
				{/key}
			{:else if player.failed}
				<div
					class="relative flex h-full items-center justify-center overflow-hidden p-6 text-center"
				>
					{#if coverUrl}
						<img
							src={coverUrl}
							alt=""
							class="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-2xl"
						/>
					{/if}
					<div role="alert" class="relative">
						<p class="text-lg font-semibold">Трейлер недоступен в вашем регионе</p>
						<p class="mt-1 text-sm text-base-content/60">
							Ни один источник не запустился.{sources.length > 1
								? ' Можно попробовать снова, выбрав источник выше.'
								: ''}
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button tabindex="-1">Закрыть</button></form>
</dialog>
