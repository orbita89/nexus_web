// Своя оценка и рецензия на карточке. Одно состояние на страницу: кнопка «Оценить» в шапке и
// форма рецензии в ленте пишут в одну рецензию (в API оценка и текст — одна запись). Только в
// браузере: на сервере сессии нет.
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import type { SchemaPutReview, SchemaReview } from '#lib/api/generated/social.ts';
import { api, session } from '#lib/auth/session.svelte.ts';

export class MyReviewState {
	review = $state<SchemaReview | null>(null);
	/** Знаем ли, есть ли своя рецензия (гостю — сразу «нет»). */
	loaded = $state(false);
	busy = $state(false);
	error = $state('');
	/** Открыта форма рецензии в ленте (её открывает и «Написать рецензию» у кнопки «Оценить»). */
	composing = $state(false);

	#slug: () => string;
	#onchange: () => void;

	/** Создавать при инициализации компонента. onchange — после любого изменения (сводка, лента). */
	constructor(slug: () => string, onchange: () => void) {
		this.#slug = slug;
		this.#onchange = onchange;
		$effect(() => {
			// Новая карточка или вход/выход — своя рецензия заново.
			const current = slug();
			this.review = null;
			this.error = '';
			this.composing = false;
			this.loaded = session.status === 'guest';
			if (session.status !== 'authed') return;
			unwrap(
				api.social.GET('/api/v1/social/entities/{slug}/review', {
					params: { path: { slug: current } }
				})
			)
				.then((review) => current === slug() && (this.review = review))
				.catch((e) => {
					if (current !== slug()) return;
					if (!(e instanceof ApiError && e.status === 404)) this.error = errorMessage(e);
				})
				.finally(() => current === slug() && (this.loaded = true));
		});
	}

	get rating(): number | null {
		return this.review?.rating ?? null;
	}

	async #run(action: () => Promise<void>): Promise<boolean> {
		this.busy = true;
		this.error = '';
		try {
			await action();
			this.#onchange();
			return true;
		} catch (e) {
			this.error = errorMessage(e);
			return false;
		} finally {
			this.busy = false;
		}
	}

	#put(body: SchemaPutReview) {
		return this.#run(async () => {
			this.review = await unwrap(
				api.social.PUT('/api/v1/social/entities/{slug}/review', {
					params: { path: { slug: this.#slug() } },
					body
				})
			);
		});
	}

	/** Поставить оценку; повторно ту же или null — снять. Текст рецензии не теряется. */
	rate(n: number | null) {
		const rating = n === this.rating ? null : n;
		// Сняли оценку, а текста нет — рецензии не остаётся.
		if (rating === null && !this.review?.body) return this.remove();
		return this.#put({ rating, body: this.review?.body ?? null });
	}

	/** Сохранить текст рецензии (оценка остаётся). */
	/** Сохранить текст рецензии и оценку (по умолчанию — текущую; null — без оценки). */
	write(body: string | null, rating: number | null = this.rating) {
		if (!body && rating === null) {
			this.error = 'Поставьте оценку или напишите текст.';
			return Promise.resolve(false);
		}
		return this.#put({ rating, body });
	}

	remove() {
		return this.#run(async () => {
			await unwrap(
				api.social.DELETE('/api/v1/social/entities/{slug}/review', {
					params: { path: { slug: this.#slug() } }
				})
			);
			this.review = null;
		});
	}
}
