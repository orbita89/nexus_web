// Лёгкая разметка в пользовательских текстах: рецензии, своя заметка, сообщения чата. Не
// полноценный Markdown — только то, чем люди правда пользуются: **жирный**, *курсив*, ~~зачёркнутый~~,
// `код`, > цитата, списки и ссылки. В комментариях разметки нет: там короткие реплики.
//
// Разбираем в структуру, а не в HTML: {@html} на пользовательском тексте для нас недопустим
// (refresh-токен лежит в localStorage, любая XSS — это угон сессии, см. docs/auth.md). Svelte
// рисует части как обычные узлы, так что экранирование делает он сам.
import { linkify } from './forum.ts';

/** Кусочек строки: обычный текст, ссылка или помеченный разметкой фрагмент. */
export type Inline =
	| { kind: 'text'; text: string }
	| { kind: 'link'; href: string; text: string }
	| { kind: 'bold' | 'italic' | 'strike' | 'code'; parts: Inline[] };

export type Block =
	{ kind: 'p' | 'quote'; parts: Inline[] } | { kind: 'list'; ordered: boolean; items: Inline[][] };

/** Парные метки: внутрь вложена та же разметка, кроме `код` — он берётся как есть. */
const MARKS = [
	{ open: '**', kind: 'bold' as const },
	{ open: '~~', kind: 'strike' as const },
	{ open: '*', kind: 'italic' as const },
	{ open: '`', kind: 'code' as const }
];

/** Ссылка вида [текст](https://…): только http(s), остальное остаётся текстом. */
const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/;

/** Разметка внутри строки — нужна и чату: там свои части (упоминания), блоков нет. */
export function parseInline(text: string): Inline[] {
	if (!text) return [];
	const link = LINK_RE.exec(text);
	// Разметка ищется слева направо: что встретилось раньше — то и разбираем первым.
	let best: { at: number; mark: (typeof MARKS)[number]; end: number } | null = null;
	for (const mark of MARKS) {
		// Метка считается парной только если прилегает к тексту: после открывающей и перед
		// закрывающей нет пробела. Иначе «5 * 3 и 2 * 2» превращалось в курсив, а это умножение.
		for (let at = text.indexOf(mark.open); at >= 0; at = text.indexOf(mark.open, at + 1)) {
			const from = at + mark.open.length;
			if (/^\s?$/.test(text[from] ?? '')) continue;
			const end = text.indexOf(mark.open, from);
			if (end < 0) break;
			// Пустые «**»: выделять нечего — это просто символы.
			if (end === from) continue;
			if (/\s/.test(text[end - 1] ?? '')) continue;
			if (!best || at < best.at) best = { at, mark, end };
			break;
		}
	}
	if (link && (!best || link.index < best.at)) {
		return [
			...parseInline(text.slice(0, link.index)),
			{ kind: 'link', href: link[2], text: link[1] },
			...parseInline(text.slice(link.index + link[0].length))
		];
	}
	if (best) {
		const inner = text.slice(best.at + best.mark.open.length, best.end);
		return [
			...parseInline(text.slice(0, best.at)),
			{
				kind: best.mark.kind,
				// Внутри `кода` разметки нет: там показывают символы как есть.
				parts: best.mark.kind === 'code' ? [{ kind: 'text', text: inner }] : parseInline(inner)
			},
			...parseInline(text.slice(best.end + best.mark.open.length))
		];
	}
	// Остаток — обычный текст, но голые адреса всё равно делаем ссылками (как было до разметки).
	return linkify(text).map((part) =>
		'href' in part
			? ({ kind: 'link', href: part.href, text: part.text } as const)
			: ({ kind: 'text', text: part.text } as const)
	);
}

const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBER = /^\s{0,3}\d{1,2}[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

/**
 * Текст в блоки: абзацы (пустая строка разделяет), цитаты и списки. Переносы внутри абзаца
 * сохраняются — люди верстают ими, и ломать это нельзя.
 */
export function parseMarkdown(text: string): Block[] {
	const blocks: Block[] = [];
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	let paragraph: string[] = [];
	let quote: string[] = [];
	let list: { ordered: boolean; items: string[] } | null = null;

	const flushParagraph = () => {
		if (paragraph.length) blocks.push({ kind: 'p', parts: parseInline(paragraph.join('\n')) });
		paragraph = [];
	};
	const flushQuote = () => {
		if (quote.length) blocks.push({ kind: 'quote', parts: parseInline(quote.join('\n')) });
		quote = [];
	};
	const flushList = () => {
		if (list)
			blocks.push({
				kind: 'list',
				ordered: list.ordered,
				items: list.items.map((i) => parseInline(i))
			});
		list = null;
	};
	const flushAll = () => {
		flushParagraph();
		flushQuote();
		flushList();
	};

	for (const line of lines) {
		const bullet = BULLET.exec(line);
		const number = NUMBER.exec(line);
		const quoted = QUOTE.exec(line);
		if (!line.trim()) {
			flushAll();
			continue;
		}
		if (bullet || number) {
			flushParagraph();
			flushQuote();
			const ordered = !!number;
			const item = (bullet ?? number)![1];
			if (list && list.ordered === ordered) list.items.push(item);
			else {
				flushList();
				list = { ordered, items: [item] };
			}
			continue;
		}
		if (quoted) {
			flushParagraph();
			flushList();
			quote.push(quoted[1]);
			continue;
		}
		flushQuote();
		flushList();
		paragraph.push(line);
	}
	flushAll();
	return blocks;
}

/** Подсказка под полем ввода: что из разметки понимает редактор. */
export const MARKDOWN_HINT = '**жирный**, *курсив*, `код`, > цитата, списки и ссылки';
