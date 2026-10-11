// Отметка «Посмотреть позже» / «Просмотрено» на карточке: GET …/mark (404 — нет), PUT {kind},
// DELETE. Личное — только у вошедшего, отдельным запросом с токеном. Нажатие меняет отметку
// сразу, ошибка — откат и сообщение.
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import { api, session } from '#lib/auth/session.svelte.ts';
import type { Mark } from './marks.ts';

export class Marks {
	/** null — нет отметки или ещё не знаем (гость, сессия грузится). */
	mark = $state<Mark | null>(null);
	busy = $state(false);
	error = $state('');

	#slug: () => string;

	/** Создавать при инициализации компонента. */
	constructor(slug: () => string) {
		this.#slug = slug;
		$effect(() => {
			// Новая карточка или вход/выход — перечитать.
			const current = slug();
			this.mark = null;
			this.error = '';
			if (session.status !== 'authed') return;
			let stale = false;
			unwrap(
				api.social.GET('/api/v1/social/entities/{slug}/mark', {
					params: { path: { slug: current } }
				})
			)
				.then((m) => !stale && (this.mark = m.kind))
				.catch((e) => {
					if (!stale && !(e instanceof ApiError && e.status === 404)) this.error = errorMessage(e);
				});
			return () => {
				stale = true;
			};
		});
	}

	/** Поставить отметку; повторно ту же — снять. */
	async toggle(mark: Mark) {
		if (this.busy || session.status !== 'authed') return;
		const before = this.mark;
		const next = before === mark ? null : mark;
		this.mark = next;
		this.busy = true;
		this.error = '';
		const params = { path: { slug: this.#slug() } };
		try {
			if (next) {
				await unwrap(
					api.social.PUT('/api/v1/social/entities/{slug}/mark', { params, body: { kind: next } })
				);
			} else {
				await unwrap(api.social.DELETE('/api/v1/social/entities/{slug}/mark', { params }));
			}
		} catch (e) {
			this.mark = before;
			this.error = errorMessage(e);
		} finally {
			this.busy = false;
		}
	}
}
