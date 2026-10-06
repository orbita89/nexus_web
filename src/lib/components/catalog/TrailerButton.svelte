<script lang="ts">
	import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
	import {
		PLAYER_ORIGIN,
		PROVIDER_NAME,
		embedUrl,
		nextIndex,
		playerSignal,
		readPreferredProvider,
		savePreferredProvider,
		shouldFallback,
		sourceLabel,
		startIndex,
		type Progress,
		type TrailerSource
	} from '#lib/catalog/trailer.ts';
	import Poster from './Poster.svelte';

	// Кнопка «Трейлер» и модалка с плеером. iframe создаётся при открытии и удаляется при закрытии:
	// заранее ничего не грузится, при закрытии видео останавливается. Источник выбирается в самом
	// плеере: стартуем с автозапуском, ждём события «играет»; нет за timeoutMs — следующий.
	let {
		sources,
		title,
		kind,
		coverUrl,
		timeoutMs = 8000
	}: {
		sources: TrailerSource[];
		title: string;
		kind: SchemaEntityKind;
		coverUrl?: string | null;
		/** Сколько ждать начала воспроизведения, прежде чем перейти к следующему источнику. */
		timeoutMs?: number;
	} = $props();

	let dialog: HTMLDialogElement;
	let iframe = $state<HTMLIFrameElement>();
	let isOpen = $state(false);
	let index = $state(0);
	let notice = $state('');
	let allFailed = $state(false);
	/** Опробованные источники в этом показе (не реактивно: в разметке не нужно). */
	let tried: number[] = [];
	let progress: Progress = { ready: false, buffering: false, playing: false };
	let timer: ReturnType<typeof setTimeout> | undefined;

	const current = $derived(sources[index]);
	const src = $derived(isOpen ? embedUrl(current, location.origin) : '');

	function arm() {
		clearTimeout(timer);
		progress = { ready: false, buffering: false, playing: false };
		timer = setTimeout(() => {
			if (shouldFallback(progress)) fallback();
		}, timeoutMs);
	}

	function play(i: number) {
		index = i;
		allFailed = false;
		if (!tried.includes(i)) tried.push(i);
		arm();
	}

	function open() {
		tried = [];
		notice = '';
		isOpen = true;
		play(startIndex(sources, readPreferredProvider()));
		dialog.showModal();
	}

	/** Источник не работает — следующий не опробованный, а если таких нет — постер и сообщение. */
	function fallback() {
		const failed = current.provider;
		const next = nextIndex(sources.length, tried);
		if (next === null) {
			clearTimeout(timer);
			allFailed = true;
			notice = '';
			return;
		}
		const to = sources[next].provider;
		notice =
			to === failed
				? `${PROVIDER_NAME[failed]}: видео недоступно, пробуем другое`
				: `${PROVIDER_NAME[failed]} недоступен, показываем ${PROVIDER_NAME[to]}`;
		play(next);
	}

	/** Ручной выбор в переключателе. */
	function choose(i: number) {
		notice = '';
		tried = [i];
		play(i);
	}

	function onClose() {
		isOpen = false;
		clearTimeout(timer);
	}

	function onMessage(event: MessageEvent) {
		if (!isOpen || allFailed || !iframe || event.source !== iframe.contentWindow) return;
		const signal = playerSignal(current.provider, event.origin, event.data);
		if (signal === null) return;
		if (signal === 'error') return fallback();
		progress.ready = true;
		if (signal === 'buffering') progress.buffering = true;
		if (signal === 'playing' && !progress.playing) {
			progress.playing = true;
			clearTimeout(timer);
			savePreferredProvider(current.provider);
		}
	}

	// YouTube присылает события, только если страница «слушает»: рукопожатие IFrame API.
	function onFrameLoad() {
		if (current.provider !== 'youtube' || !iframe?.contentWindow) return;
		const post = (message: object) =>
			iframe?.contentWindow?.postMessage(
				JSON.stringify({ ...message, id: 1, channel: 'widget' }),
				PLAYER_ORIGIN.youtube
			);
		post({ event: 'listening' });
		post({ event: 'command', func: 'addEventListener', args: ['onStateChange'] });
		post({ event: 'command', func: 'addEventListener', args: ['onError'] });
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
								{ 'btn-primary': i === index && !allFailed }
							]}
							aria-pressed={i === index && !allFailed}
							onclick={() => choose(i)}>{sourceLabel(sources, i)}</button
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

		{#if notice}
			<p role="status" class="mb-2 text-sm text-warning">{notice}</p>
		{/if}

		<div class="aspect-video w-full overflow-hidden rounded-box bg-black">
			{#if isOpen && !allFailed}
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
			{:else if allFailed}
				<div class="flex h-full items-center justify-center gap-6 bg-base-300 p-6">
					<div class="w-24 shrink-0 sm:w-36">
						<Poster {title} {kind} {coverUrl} />
					</div>
					<div role="alert">
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
