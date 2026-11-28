// «Моё» — снимок личного пользователя (GET /social/users/me/state): отметки, лайки, свои оценки,
// реакции, заметки, интересы, голоса за подборки. Страницы сайта — статика, нарисованная как для
// гостя; личное кнопки берут отсюда, а не спрашивают сервер каждая сама.
//
// Где живёт: в памяти и в localStorage (`nexus.me`: владелец, время, ETag, снимок). Свежий (младше
// FRESH_MS) — запросов нет вовсе. Старше — один запрос с If-None-Match: не менялся — 304 (сервер
// читает одну строку версии). Свои действия правят снимок сразу (patch*), без перечитывания.
// Изменения с другого устройства видны после FRESH_MS или при возврате на вкладку после него.
import { api, session } from '#lib/auth/session.svelte.ts';
import type { components } from '#lib/api/generated/social.ts';

export type MyState = components['schemas']['MyState'];
export type EntityState = components['schemas']['EntityState'];
export type PersonState = components['schemas']['PersonState'];

const KEY = 'nexus.me';
const FRESH_MS = 30 * 60_000;

type Stored = { user: string; at: number; etag: string | null; data: MyState };

function read(): Stored | null {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as Stored) : null;
	} catch {
		return null;
	}
}

function write(s: Stored | null) {
	try {
		if (s) localStorage.setItem(KEY, JSON.stringify(s));
		else localStorage.removeItem(KEY);
	} catch {
		// Хранилище недоступно или полно — снимок живёт только в памяти.
	}
}

class Me {
	/** null — гость, сессия грузится или снимок ещё не пришёл. */
	data = $state<MyState | null>(null);
	#user: string | null = null;
	#at = 0;
	#etag: string | null = null;
	#loading: Promise<void> | null = null;

	/** Снимок пришёл (у вошедшего). Пока нет — кнопки показывают «не знаем», а не «нет». */
	get ready() {
		return this.data !== null;
	}

	entity(slug: string): EntityState {
		return this.data?.entities[slug] ?? {};
	}

	person(slug: string): PersonState {
		return this.data?.people[slug] ?? {};
	}

	watchingTag(slug: string): boolean {
		return this.data?.tags.includes(slug) ?? false;
	}

	collectionVote(id: string): number | null {
		return this.data?.collections[id] ?? null;
	}

	/** Вход, выход, смена пользователя — вызывает корневой layout. */
	sync(username: string | null) {
		if (username === this.#user) return void this.refresh();
		this.#user = username;
		this.data = null;
		this.#etag = null;
		this.#at = 0;
		if (!username) return;
		const saved = read();
		if (saved?.user === username) {
			this.data = saved.data;
			this.#at = saved.at;
			this.#etag = saved.etag;
		} else if (saved) {
			write(null);
		}
		void this.refresh();
	}

	/** Спросить сервер, если снимок старше FRESH_MS (или force). */
	refresh(force = false): Promise<void> {
		if (!this.#user || session.status !== 'authed') return Promise.resolve();
		if (!force && this.data && Date.now() - this.#at < FRESH_MS) return Promise.resolve();
		return (this.#loading ??= this.#fetch().finally(() => (this.#loading = null)));
	}

	async #fetch() {
		const user = this.#user;
		const { data, response } = await api.social.GET('/api/v1/social/users/me/state', {
			headers: this.data && this.#etag ? { 'If-None-Match': this.#etag } : {},
			cache: 'no-store'
		});
		if (user !== this.#user || !user) return;
		if (response.status === 304 && this.data) {
			this.#at = Date.now();
		} else if (response.ok && data) {
			this.data = data;
			this.#etag = response.headers.get('etag');
			this.#at = Date.now();
		} else {
			return;
		}
		this.#save();
	}

	#save() {
		if (this.#user && this.data)
			write({ user: this.#user, at: this.#at, etag: this.#etag, data: $state.snapshot(this.data) });
	}

	/** Своё действие над произведением: правим снимок сразу. undefined в patch — поле убрать. */
	patchEntity(slug: string, patch: Partial<EntityState>) {
		if (!this.data) return;
		const next = { ...this.data.entities[slug], ...patch };
		for (const k of Object.keys(next) as (keyof EntityState)[])
			if (next[k] === undefined || next[k] === false) delete next[k];
		this.data.entities[slug] = next;
		this.#save();
	}

	patchPerson(slug: string, patch: Partial<PersonState>) {
		if (!this.data) return;
		const next = { ...this.data.people[slug], ...patch };
		for (const k of Object.keys(next) as (keyof PersonState)[])
			if (next[k] === undefined || next[k] === false) delete next[k];
		this.data.people[slug] = next;
		this.#save();
	}

	setTag(slug: string, watching: boolean) {
		if (!this.data) return;
		const tags = this.data.tags.filter((t) => t !== slug);
		this.data.tags = watching ? [...tags, slug] : tags;
		this.#save();
	}

	setCollectionVote(id: string, value: number | null) {
		if (!this.data) return;
		if (value) this.data.collections[id] = value;
		else delete this.data.collections[id];
		this.#save();
	}
}

export const me = new Me();
