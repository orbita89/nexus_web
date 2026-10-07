<script lang="ts">
	import { linkify } from '#lib/social/forum.ts';

	// Пользовательский текст: переносы строк сохраняются, адреса http(s) — ссылки. Никакого
	// {@html}: refresh-токен в localStorage, XSS для нас критичен (docs/auth.md).
	let { text, class: className = '' }: { text: string; class?: string } = $props();
</script>

<p class="leading-relaxed break-words whitespace-pre-line {className}">
	{#each linkify(text) as part, i (i)}{#if 'href' in part}<a
				href={part.href}
				class="link link-primary"
				target="_blank"
				rel="nofollow noopener noreferrer ugc">{part.text}</a
			>{:else}{part.text}{/if}{/each}
</p>
