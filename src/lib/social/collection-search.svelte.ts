// Админ: поиск коллекций на сервере (GET /admin/collections) с задержкой ввода и «Показать ещё».

import { errorMessage } from '#lib/api/errors.ts';
import type { SchemaCollection } from '#lib/api/generated/social.ts';
import { api } from '#lib/auth/session.svelte.ts';
import { adminSearchCollections, adminSearchError } from '#lib/social/collections.ts';

const DEBOUNCE_MS = 300;

export class CollectionSearch {
	query = $state('');
	items = $state<SchemaCollection[]>([]);
	total = $state(0);
	loading = $state(false);
	error = $state('');
	/** Хотя бы одна страница по текущему запросу получена. */
	loaded = $state(false);

	readonly more = $derived(this.items.length < this.total);

	#timer: ReturnType<typeof setTimeout> | undefined;
	#seq = 0;
	readonly #opts: { public?: boolean; featured?: boolean; limit: number };

	constructor(opts: { public?: boolean; featured?: boolean; limit?: number } = {}) {
		this.#opts = { limit: 20, ...opts };
	}

	/** Ввод запроса: новый поиск через 300 мс тишины. */
	setQuery(q: string) {
		this.query = q;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.#fetch(true), DEBOUNCE_MS);
	}

	/** Сразу заново с первой страницы (первое открытие, обновление). */
	reload() {
		clearTimeout(this.#timer);
		return this.#fetch(true);
	}

	loadMore() {
		if (this.loading || !this.more) return;
		return this.#fetch(false);
	}

	/** Заменить коллекцию в результатах (после правки). */
	replace(c: SchemaCollection) {
		this.items = this.items.map((x) => (x.id === c.id ? c : x));
	}

	destroy() {
		clearTimeout(this.#timer);
		this.#seq++;
	}

	async #fetch(reset: boolean) {
		const seq = ++this.#seq;
		this.loading = true;
		this.error = '';
		try {
			const page = await adminSearchCollections(api, {
				q: this.query,
				public: this.#opts.public,
				featured: this.#opts.featured,
				limit: this.#opts.limit,
				offset: reset ? 0 : this.items.length
			});
			if (seq !== this.#seq) return;
			if (reset) this.items = page.items;
			else {
				const seen = this.items.map((c) => c.id);
				this.items = [...this.items, ...page.items.filter((c) => !seen.includes(c.id))];
			}
			this.total = page.total;
			this.loaded = true;
		} catch (e) {
			if (seq !== this.#seq) return;
			this.error = adminSearchError(e, errorMessage);
		} finally {
			if (seq === this.#seq) this.loading = false;
		}
	}
}
