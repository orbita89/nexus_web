// Отметка «Посмотреть позже» / «Просмотрено» на карточке. Своя отметка — из снимка «моего»
// (me.svelte.ts), без запроса; PUT {kind} / DELETE. Нажатие меняет отметку сразу, ошибка — откат
// и сообщение.
import { errorMessage, unwrap } from '#lib/api/errors.ts';
import { api, session } from '#lib/auth/session.svelte.ts';
import { dropLater, type Mark } from './marks.ts';
import { me } from './me.svelte.ts';

export class Marks {
	busy = $state(false);
	error = $state('');

	#slug: () => string;

	/** Создавать при инициализации компонента. */
	constructor(slug: () => string) {
		this.#slug = slug;
	}

	/** null — нет отметки или ещё не знаем (гость, сессия грузится, снимок не пришёл). */
	get mark(): Mark | null {
		if (session.status !== 'authed') return null;
		return (me.entity(this.#slug()).mark as Mark | undefined) ?? null;
	}

	/** Поставить отметку; повторно ту же — снять. */
	async toggle(mark: Mark) {
		if (this.busy || session.status !== 'authed') return;
		const slug = this.#slug();
		const before = this.mark;
		const next = before === mark ? null : mark;
		me.patchEntity(slug, { mark: next ?? undefined });
		this.busy = true;
		this.error = '';
		const params = { path: { slug } };
		try {
			if (next) {
				await unwrap(
					api.social.PUT('/api/v1/social/entities/{slug}/mark', { params, body: { kind: next } })
				);
			} else {
				await unwrap(api.social.DELETE('/api/v1/social/entities/{slug}/mark', { params }));
			}
			// «Отложено» на главной изменилось (поставили, сняли или «позже» сменилось на «просмотрено»).
			if (next === 'later' || before === 'later') dropLater();
		} catch (e) {
			me.patchEntity(slug, { mark: before ?? undefined });
			this.error = errorMessage(e);
		} finally {
			this.busy = false;
		}
	}
}
