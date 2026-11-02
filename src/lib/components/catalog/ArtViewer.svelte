<script lang="ts">
	// Картина во весь экран с увеличением: колесо (или кнопки) меняет масштаб, перетаскивание
	// двигает холст, двойной щелчок — приблизить/вернуть, Esc закрывает. Всё в браузере: страница
	// карточки остаётся статикой (пререндер), окно открывается только по нажатию.
	let {
		src,
		title,
		children
	}: {
		src: string;
		title: string;
		/** Содержимое кнопки — сам холст в карточке. */
		children: import('svelte').Snippet;
	} = $props();

	const MIN = 1;
	const MAX = 6;
	const STEP = 1.4;

	let dialog: HTMLDialogElement;
	let open = $state(false);
	let zoom = $state(1);
	/** Сдвиг холста в пикселях экрана; при zoom = 1 всегда ноль. */
	let x = $state(0);
	let y = $state(0);
	let dragging = $state(false);
	let from = { x: 0, y: 0 };

	const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

	function reset() {
		zoom = 1;
		x = 0;
		y = 0;
	}

	function show() {
		reset();
		open = true;
		dialog.showModal();
	}

	/** Масштаб с сохранением точки под курсором: иначе при увеличении картина уезжает. */
	function scaleAt(next: number, clientX?: number, clientY?: number) {
		const value = clamp(next);
		if (value === zoom) return;
		if (clientX !== undefined && clientY !== undefined) {
			const box = dialog.getBoundingClientRect();
			const dx = clientX - (box.left + box.width / 2);
			const dy = clientY - (box.top + box.height / 2);
			const k = value / zoom;
			x = dx - (dx - x) * k;
			y = dy - (dy - y) * k;
		}
		zoom = value;
		if (zoom === MIN) {
			x = 0;
			y = 0;
		}
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		scaleAt(zoom * (event.deltaY < 0 ? STEP : 1 / STEP), event.clientX, event.clientY);
	}

	function onPointerDown(event: PointerEvent) {
		if (zoom === MIN) return;
		dragging = true;
		from = { x: event.clientX - x, y: event.clientY - y };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging) return;
		x = event.clientX - from.x;
		y = event.clientY - from.y;
	}
</script>

<!-- Холст в карточке — кнопка: открывает полноэкранный просмотр. -->
<button
	type="button"
	onclick={show}
	class="block w-full cursor-zoom-in rounded-box outline-offset-4"
	aria-label="Открыть во весь экран: {title}"
>
	{@render children()}
</button>

<dialog
	bind:this={dialog}
	class="modal"
	aria-label={title}
	onclose={() => {
		open = false;
		reset();
	}}
>
	<div class="modal-box flex h-screen w-screen max-w-none flex-col rounded-none bg-base-100 p-0">
		<!-- Панели лежат над холстом, поэтому со своим фоном: иначе подписи теряются в картине. -->
		<div class="relative z-10 flex items-center gap-2 bg-base-100/80 px-4 py-3 backdrop-blur-md">
			<h2 class="min-w-0 truncate font-bold">{title}</h2>
			<div class="ml-auto flex items-center gap-1">
				<button
					class="btn btn-circle btn-ghost btn-sm"
					aria-label="Отдалить"
					onclick={() => scaleAt(zoom / STEP)}>−</button
				>
				<span class="w-12 text-center font-mono text-xs text-base-content/50"
					>{Math.round(zoom * 100)}%</span
				>
				<button
					class="btn btn-circle btn-ghost btn-sm"
					aria-label="Приблизить"
					onclick={() => scaleAt(zoom * STEP)}>+</button
				>
				<form method="dialog">
					<button class="btn btn-circle btn-ghost btn-sm" aria-label="Закрыть">✕</button>
				</form>
			</div>
		</div>

		<!-- Колесо и перетаскивание — на всей площади, а не только на холсте. -->
		<div
			role="presentation"
			class={[
				'relative flex-1 overflow-hidden',
				zoom > MIN ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
			]}
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={() => (dragging = false)}
			onpointercancel={() => (dragging = false)}
			ondblclick={(e) => (zoom > MIN ? reset() : scaleAt(2.5, e.clientX, e.clientY))}
		>
			{#if open}
				<img
					{src}
					alt={title}
					draggable="false"
					class="absolute inset-0 m-auto max-h-full max-w-full object-contain select-none"
					style="translate: {x}px {y}px; scale: {zoom}; transition: {dragging
						? 'none'
						: 'translate 150ms, scale 150ms'}"
				/>
			{/if}
		</div>
		<p
			class="relative z-10 bg-base-100/80 px-4 py-2 text-center text-xs text-base-content/50 backdrop-blur-md"
		>
			Колесо — масштаб, перетаскивание — двигать, двойной щелчок — приблизить, Esc — закрыть
		</p>
	</div>
	<form method="dialog" class="modal-backdrop"><button aria-label="Закрыть">Закрыть</button></form>
</dialog>
