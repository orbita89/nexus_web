// «Следить» — сущность, человек или тег в интересах: темы и рецензии попадают в ленту, чат
// комнаты — в «Мои чаты».
// Одно состояние на карточку: колокольчик в шапке и в липкой мобильной шапке — одна подписка.
// Изменили на другом устройстве или вкладке — interest.added / interest.removed в user:me.
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import { api, session } from '#lib/auth/session.svelte.ts';
import { useRealtime } from '#lib/realtime/realtime.svelte.ts';

/** Что в интересах: путь API и поле id в событиях interest.added / interest.removed. */
const TARGETS = {
	entities: 'entity_id',
	people: 'person_id',
	tags: 'tag_id'
} as const;
export type WatchTarget = keyof typeof TARGETS;

export class Watch {
	/** null — ещё не знаем (гость, сессия грузится, запрос в пути). */
	watching = $state<boolean | null>(null);
	busy = $state(false);
	error = $state('');

	#slug: () => string;
	#target: WatchTarget;

	/** Создавать при инициализации компонента: внутри $effect и подписка реалтайма. */
	constructor(slug: () => string, id: () => string, target: WatchTarget = 'entities') {
		this.#slug = slug;
		this.#target = target;
		$effect(() => {
			const current = slug();
			this.watching = null;
			this.error = '';
			if (session.status !== 'authed') return;
			unwrap(
				api.social.GET(
					`/api/v1/social/${target}/{slug}/interest` as '/api/v1/social/entities/{slug}/interest',
					{
						params: { path: { slug: current } }
					}
				)
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
				if (event.data[TARGETS[target]] !== id()) return;
				if (event.event === 'interest.added') this.watching = true;
				if (event.event === 'interest.removed') this.watching = false;
			}
		);
	}

	async toggle() {
		const next = !this.watching;
		const params = { path: { slug: this.#slug() } };
		// Пути трёх видов интересов устроены одинаково: PUT / DELETE, 204.
		const path =
			`/api/v1/social/${this.#target}/{slug}/interest` as '/api/v1/social/entities/{slug}/interest';
		this.busy = true;
		this.error = '';
		try {
			await unwrap(next ? api.social.PUT(path, { params }) : api.social.DELETE(path, { params }));
			this.watching = next;
		} catch (e) {
			this.error = errorMessage(e);
		} finally {
			this.busy = false;
		}
	}
}
