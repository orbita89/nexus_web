// Вывод content_html баннеров. Бэкенд HTML уже санитизирует (allowlist), на фронте — ещё раз
// DOMPurify. DOMPurify нужен DOM, поэтому санитизация только в браузере; при SSR
// (и пока не гидратировались) выводим только текст без разметки — это безопасно всегда.
import DOMPurify from 'dompurify';

let hooked = false;

function setup() {
	if (hooked) return;
	hooked = true;
	// Внешние ссылки — в новой вкладке; внутренние (/…) остаются обычными <a>,
	// их клики перехватывает роутер SvelteKit.
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName !== 'A') return;
		const href = node.getAttribute('href') ?? '';
		if (isExternal(href)) {
			node.setAttribute('target', '_blank');
			node.setAttribute('rel', 'noopener noreferrer');
		} else {
			node.removeAttribute('target');
		}
	});
}

export const isExternal = (href: string) => /^https?:\/\//i.test(href) || href.startsWith('//');

/** Санитизированный HTML (только в браузере). */
export function sanitizeBannerHtml(html: string): string {
	setup();
	return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form'] });
}

/** Текстовый запасной вариант для SSR: теги вырезаются, текст экранирует сам Svelte. */
export function bannerHtmlText(html: string): string {
	return html
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}
