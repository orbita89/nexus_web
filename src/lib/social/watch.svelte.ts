// «Следить» — сущность в интересах: её темы и рецензии попадают в ленту и приходят вживую.
// Одно состояние на карточку: колокольчик в шапке и в липкой мобильной шапке — одна подписка.
// Изменили на другом устройстве или вкладке — interest.added / interest.removed в user:me.
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import { api, session } from '#lib/auth/session.svelte.ts';
import { useRealtime } from '#lib/realtime/realtime.svelte.ts';

export class Watch {
	/** null — ещё не знаем (гость, сессия грузится, запрос в пути). */
	watching = $state<boolean | null>(null);
	busy = $state(false);
	error = $state('');

	#slug: () => string;

	/** Создавать при инициализации компонента: внутри $effect и подписка реалтайма. */
	constructor(slug: () => string, entityId: () => string) {
		this.#slug = slug;
		$effect(() => {
			const current = slug();
			this.watching = null;
			this.error = '';
			if (session.status !== 'authed') return;
			unwrap(
				api.social.GET('/api/v1/social/entities/{slug}/interest', {
					params: { path: { slug: current } }
				})
			)
				.then(() => current === slug() && (this.watching = true))
				.catch((e) => {
					if (current !== slug()) return;
					if (e instanceof ApiError && e.status === 404) this.watching = false;
					else this.error = errorMessage(e);
				});
		});

		useRealtime(
			() => (session.status === 'authed' ? ['user:me'] : []),
			(event) => {
				if (event.data.entity_id !== entityId()) return;
				if (event.event === 'interest.added') this.watching = true;
				if (event.event === 'interest.removed') this.watching = false;
			}
		);
	}

	async toggle() {
		const next = !this.watching;
		const params = { path: { slug: this.#slug() } };
		this.busy = true;
		this.error = '';
		try {
			await unwrap(
				next
					? api.social.PUT('/api/v1/social/entities/{slug}/interest', { params })
					: api.social.DELETE('/api/v1/social/entities/{slug}/interest', { params })
			);
			this.watching = next;
		} catch (e) {
			this.error = errorMessage(e);
		} finally {
			this.busy = false;
		}
	}
}
