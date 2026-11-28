// «Следить» — сущность, человек или тег в интересах: темы и рецензии попадают в ленту, чат
// комнаты — в «Мои чаты».
// Одно состояние на карточку: колокольчик в шапке и в липкой мобильной шапке — одна подписка.
// Изменили на другом устройстве или вкладке — interest.added / interest.removed в user:me.
import { errorMessage, unwrap } from '#lib/api/errors.ts';
import { api, session } from '#lib/auth/session.svelte.ts';
import { useRealtime } from '#lib/realtime/realtime.svelte.ts';
import { me } from './me.svelte.ts';

/** Что в интересах: путь API и поле id в событиях interest.added / interest.removed. */
const TARGETS = {
	entities: 'entity_id',
	people: 'person_id',
	tags: 'tag_id'
} as const;
export type WatchTarget = keyof typeof TARGETS;

export class Watch {
	busy = $state(false);
	error = $state('');

	#slug: () => string;
	#target: WatchTarget;

	/**
	 * Следит ли пользователь. null — ещё не знаем (гость, сессия грузится, снимок не пришёл).
	 * Берётся из снимка «моего» (me.svelte.ts) — отдельного запроса нет.
	 */
	get watching(): boolean | null {
		if (session.status !== 'authed' || !me.ready) return null;
		const slug = this.#slug();
		if (this.#target === 'tags') return me.watchingTag(slug);
		if (this.#target === 'people') return !!me.person(slug).watching;
		return !!me.entity(slug).watching;
	}

	/** Создавать при инициализации компонента: внутри подписка реалтайма. */
	constructor(slug: () => string, id: () => string, target: WatchTarget = 'entities') {
		this.#slug = slug;
		this.#target = target;

		// ВРЕМЕННО ОТКЛЮЧЕНО (docs/realtime.md): синхронизация колокольчика между вкладками и
		// устройствами по WebSocket. Включить обратно — вернуть `['user:me']` для вошедшего.
		useRealtime(
			() => [],
			(event) => {
				if (event.data[TARGETS[target]] !== id()) return;
				if (event.event === 'interest.added') this.#set(true);
				if (event.event === 'interest.removed') this.#set(false);
			}
		);
	}

	#set(watching: boolean) {
		const slug = this.#slug();
		if (this.#target === 'tags') me.setTag(slug, watching);
		else if (this.#target === 'people') me.patchPerson(slug, { watching });
		else me.patchEntity(slug, { watching });
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
			this.#set(next);
		} catch (e) {
			this.error = errorMessage(e);
		} finally {
			this.busy = false;
		}
	}
}
