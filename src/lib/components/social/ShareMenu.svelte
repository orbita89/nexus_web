<script lang="ts">
	import { onMount } from 'svelte';

	// «Поделиться»: меню соцсетей, копирование ссылки и системный диалог (где есть).
	// compact — только иконка (для строки заголовка).
	let { url, title, compact = false }: { url: string; title: string; compact?: boolean } = $props();

	const enc = encodeURIComponent;
	const targets = $derived([
		{
			name: 'Telegram',
			badge: 'TG',
			href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`
		},
		{
			name: 'ВКонтакте',
			badge: 'VK',
			href: `https://vk.com/share.php?url=${enc(url)}&title=${enc(title)}`
		},
		{ name: 'WhatsApp', badge: 'WA', href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
		{
			name: 'X',
			badge: 'X',
			href: `https://x.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`
		},
		{
			name: 'Одноклассники',
			badge: 'OK',
			href: `https://connect.ok.ru/offer?url=${enc(url)}&title=${enc(title)}`
		}
	]);

	// Системный диалог есть не везде — узнаём только в браузере (после гидратации).
	let canNative = $state(false);
	onMount(() => {
		canNative = typeof navigator.share === 'function';
	});

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 2500);
		} catch {
			copied = false;
		}
	}

	async function native() {
		try {
			await navigator.share({ title, url });
		} catch {
			// отмена или отказ — ничего не делаем
		}
	}
</script>

{#snippet shareIcon(cls: string)}
	<svg
		viewBox="0 0 24 24"
		class={cls}
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
		<path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
	</svg>
{/snippet}

<div class="inline-flex items-center gap-3">
	<div class={['dropdown', !compact && 'dropdown-center dropdown-top']}>
		<div
			tabindex="0"
			role="button"
			class={compact ? 'btn btn-square btn-ghost btn-xs' : 'btn btn-ghost btn-sm'}
			aria-label="Поделиться"
			title="Поделиться"
		>
			{@render shareIcon('h-4 w-4')}
			{#if !compact}Поделиться{/if}
		</div>
		<ul
			tabindex="-1"
			class="{compact
				? 'mt-1'
				: 'mb-1'} menu dropdown-content z-40 w-56 rounded-box bg-base-100 p-2 shadow-lg ring-1 ring-base-content/10"
		>
			{#each targets as t (t.name)}
				<li>
					<a href={t.href} target="_blank" rel="noopener noreferrer">
						<span
							class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-base-content/30 text-[0.6rem] font-bold"
							aria-hidden="true">{t.badge}</span
						>
						{t.name}
					</a>
				</li>
			{/each}
			<li>
				<button type="button" onclick={copy}>
					<svg
						viewBox="0 0 24 24"
						class="h-6 w-6 p-1"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path
							d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"
						/>
					</svg>
					Копировать ссылку
				</button>
			</li>
			{#if canNative}
				<li>
					<button type="button" onclick={native}>
						{@render shareIcon('h-6 w-6 p-1')}
						Другое…
					</button>
				</li>
			{/if}
		</ul>
	</div>
	<span class="text-sm text-base-content/60" role="status"
		>{copied ? 'Ссылка скопирована' : ''}</span
	>
</div>
