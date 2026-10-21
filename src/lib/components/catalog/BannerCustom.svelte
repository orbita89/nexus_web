<script lang="ts">
	import { page } from '$app/state';

	// Готовый HTML баннера (kind=custom): своя вёрстка со стилями — в изолированном iframe без
	// скриптов, чтобы стили баннера не задевали сайт и наоборот. Бэкенд HTML уже очистил; sandbox
	// без allow-scripts — вторая линия защиты. Ссылки открываются во всём окне (<base target=_top>),
	// пути /… — от адреса сайта.
	let { html, title, eager = false }: { html: string; title: string; eager?: boolean } = $props();

	const RESET =
		'<style>html,body{margin:0;height:100%;overflow:hidden}*,*::before,*::after{box-sizing:border-box}</style>';

	const srcdoc = $derived(
		`<!doctype html><html><head><meta charset="utf-8"><base href="${page.url.origin}/" target="_top">${RESET}</head><body>${html}</body></html>`
	);
</script>

<iframe
	{title}
	{srcdoc}
	sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
	loading={eager ? 'eager' : 'lazy'}
	class="block h-full w-full border-0"
></iframe>
