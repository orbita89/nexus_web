// Возврат фильмов из архива на сайт: какие запросы идут и тосты с итогом. Один экземпляр на
// страницу (админский «Архив», блок «В архиве» в поиске). Тосты живут здесь, а не в строке:
// строка после успеха исчезает вместе с кнопкой.

import { SvelteSet } from 'svelte/reactivity';
import { unwrap } from '#lib/api/errors.ts';
import type { SchemaArchiveDoc } from '#lib/api/generated/catalog.ts';
import { api } from '#lib/auth/session.svelte.ts';
import { entityHref } from '#lib/catalog/kinds.ts';
import { promoteFailure } from './archive';

export interface PromoteToast {
	id: number;
	ok: boolean;
	title: string;
	message: string;
	siteHref: string | null;
	editHref: string | null;
}

let nextId = 0;

export class Promotions {
	/** slug-и, по которым запрос ещё идёт (несколько секунд: поиск и статика — синхронно). */
	readonly pending = new SvelteSet<string>();
	toasts = $state<PromoteToast[]>([]);

	/** onGone — документа в архиве больше нет (вернули мы или кто-то раньше): убрать строку. */
	constructor(private readonly onGone: (slug: string) => void) {}

	async promote(doc: SchemaArchiveDoc) {
		if (this.pending.has(doc.slug)) return;
		this.pending.add(doc.slug);
		try {
			const entity = await unwrap(
				api.catalog.POST('/api/v1/catalog/admin/archive/promote/{slug}', {
					params: { path: { slug: doc.slug } }
				})
			);
			this.onGone(doc.slug);
			this.show({
				ok: true,
				title: 'Фильм возвращён на сайт',
				message: entity.title,
				siteHref: entityHref(entity),
				editHref: `/admin/entities/${entity.slug}`
			});
		} catch (e) {
			const failure = promoteFailure(e, doc);
			if (failure.gone) this.onGone(doc.slug);
			this.show({
				ok: false,
				title: doc.title,
				message: failure.message,
				siteHref: failure.siteHref,
				editHref: null
			});
		} finally {
			this.pending.delete(doc.slug);
		}
	}

	dismiss(toast: PromoteToast) {
		this.toasts = this.toasts.filter((t) => t.id !== toast.id);
	}

	private show(toast: Omit<PromoteToast, 'id'>) {
		const shown = { ...toast, id: ++nextId };
		this.toasts = [...this.toasts.slice(-2), shown];
		setTimeout(() => this.dismiss(shown), 15_000);
	}
}
