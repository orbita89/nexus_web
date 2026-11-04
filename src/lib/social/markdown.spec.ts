import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown.ts';

describe('parseInline', () => {
	it('жирный, курсив и код', () => {
		expect(parseInline('очень **важно** и *тонко*')).toEqual([
			{ kind: 'text', text: 'очень ' },
			{ kind: 'bold', parts: [{ kind: 'text', text: 'важно' }] },
			{ kind: 'text', text: ' и ' },
			{ kind: 'italic', parts: [{ kind: 'text', text: 'тонко' }] }
		]);
		expect(parseInline('`npm run dev`')).toEqual([
			{ kind: 'code', parts: [{ kind: 'text', text: 'npm run dev' }] }
		]);
	});

	it('внутри кода разметку не разбирает', () => {
		expect(parseInline('`**не жирный**`')).toEqual([
			{ kind: 'code', parts: [{ kind: 'text', text: '**не жирный**' }] }
		]);
	});

	it('ссылка [текст](адрес) и голый адрес', () => {
		expect(parseInline('[тут](https://a.ru)')).toEqual([
			{ kind: 'link', href: 'https://a.ru', text: 'тут' }
		]);
		expect(parseInline('см. https://a.ru')).toEqual([
			{ kind: 'text', text: 'см. ' },
			{ kind: 'link', href: 'https://a.ru', text: 'https://a.ru' }
		]);
	});

	// Незакрытые метки — обычный текст: человек просто поставил звёздочку.
	it('одиночные символы не ломают текст', () => {
		expect(parseInline('5 * 3 и ** пусто')).toEqual([{ kind: 'text', text: '5 * 3 и ** пусто' }]);
	});
});

describe('parseMarkdown', () => {
	it('абзацы, список и цитата', () => {
		const blocks = parseMarkdown('Первый\nабзац\n\n- раз\n- два\n\n> цитата');
		expect(blocks.map((b) => b.kind)).toEqual(['p', 'list', 'quote']);
		expect(blocks[0]).toEqual({ kind: 'p', parts: [{ kind: 'text', text: 'Первый\nабзац' }] });
		expect(blocks[1]).toEqual({
			kind: 'list',
			ordered: false,
			items: [[{ kind: 'text', text: 'раз' }], [{ kind: 'text', text: 'два' }]]
		});
	});

	it('нумерованный список отделён от маркированного', () => {
		const blocks = parseMarkdown('1. раз\n2. два\n- буллет');
		expect(blocks.map((b) => b.kind === 'list' && b.ordered)).toEqual([true, false]);
	});

	it('пустой текст — ни одного блока', () => {
		expect(parseMarkdown('')).toEqual([]);
	});
});
