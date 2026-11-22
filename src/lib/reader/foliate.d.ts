// foliate-js — чистый JS без типов: объявляем то, что использует читалка.
declare module 'foliate-js/view.js' {
	/** Регистрирует элемент <foliate-view>. */
	const _: unknown;
	export default _;
}

declare module 'foliate-js/footnotes.js' {
	export class FootnoteHandler extends EventTarget {
		detectFootnotes: boolean;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		handle(book: any, event: Event): Promise<void> | undefined;
	}
}

declare module 'foliate-js/overlayer.js' {
	export class Overlayer {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		static highlight(rects: any, options?: { color?: string }): SVGElement;
	}
}
