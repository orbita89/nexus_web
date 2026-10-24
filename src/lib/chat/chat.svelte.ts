// Чат в правой панели: список «Мои чаты», открытая комната, отправка и живые события.
// Одно состояние на вкладку (chat), подключается к реалтайму в ChatPanel — она есть на всех
// страницах. Протокол — nexus_project/documents/api/social.json, тег chat.
//
// - отправка — по WebSocket, оптимистично: временное сообщение с client_id, chat.sent заменяет
//   его настоящим, error помечает «не отправлено» (с кнопкой «повторить»);
// - прочитано — chat.read с задержкой, когда последнее сообщение видно (seen);
// - свёрнута ли панель и открытая комната — в localStorage.
import { browser } from '$app/env';
import type {
	SchemaChatMessage,
	SchemaChatRoomInfo,
	SchemaChatSearchHit,
	SchemaChatSummary,
	SchemaCustomRoom,
	SchemaUserRef
} from '#lib/api/generated/social.ts';
import { ApiError, errorMessage, unwrap } from '#lib/api/errors.ts';
import { api, guestApi, session } from '#lib/auth/session.svelte.ts';
import type { RealtimeEvent, ReplyMessage } from '#lib/realtime/client.ts';
import { sendRealtime } from '#lib/realtime/realtime.svelte.ts';
import {
	GENERAL,
	roomMeta,
	sendError,
	splitRoom,
	systemMeta,
	topicOf,
	TOPICS,
	type RoomMeta,
	type Topic
} from './rooms.ts';

export type Message = SchemaChatMessage;

/**
 * Вкладка панели: «Каталог» — общие чаты (чипами), «Каналы» — фильмы, люди, темы и комнаты,
 * «Чаты» — личные переписки один на один.
 */
export type Tab = 'catalog' | 'channels' | 'dm';

const TABS: Tab[] = ['catalog', 'channels', 'dm'];

/** Что показывает вкладка «Каналы»: где я состою или где сейчас говорят. */
export type ListView = 'mine' | 'live';

/** Сообщение в ленте; своё неотправленное — с client_id и состоянием. */
export type Item = Message & {
	clientId?: string;
	status?: 'sending' | 'failed';
	error?: string;
	/** Когда можно повторить (ms), после «слишком часто». */
	retryAt?: number;
};

const STORAGE = 'nexus.chat';
const HISTORY_PAGE = 50;
/** chat.read — не на каждое сообщение: ждём, пока последнее видно столько. */
const READ_DELAY_MS = 1500;
const TOAST_MS = 6000;

export interface Toast {
	id: string;
	meta: RoomMeta;
	message: Message;
	/** Вас упомянули: показываем даже в заглушённой комнате и помечаем. */
	mention?: boolean;
}

/** id сущности, человека, тега или комнаты — как target_id в событиях. */
function targetId(chat: SchemaChatSummary): string | undefined {
	return (chat.entity ?? chat.person ?? chat.tag ?? chat.custom)?.id;
}

const client = () => (session.status === 'authed' ? api : guestApi);

class Chat {
	/** Свёрнута в полосу с иконками (десктоп). */
	collapsed = $state(false);
	/** Лист открыт (мобильная ширина). */
	sheet = $state(false);
	/** Вкладка панели. «Общий» и «Каталог» — сами чаты, «Комнаты» — список. */
	tab = $state<Tab>('catalog');
	/** Какой из чатов «Каталога» открыт. */
	topic = $state<Topic>(GENERAL);
	/** Вкладка «Чаты»: мои или те, где сейчас обсуждают. */
	listView = $state<ListView>('mine');
	/** Комната, открытая поверх вкладки: с карточки, из списка комнат, из уведомления. */
	adhoc = $state<RoomMeta | null>(null);

	/** null — гость или ещё не загружен. */
	chats = $state<SchemaChatSummary[] | null>(null);
	chatsLoading = $state(false);
	chatsError = $state('');

	/** Комнаты вкладки «Обсуждается»; null — ещё не запрашивали. */
	suggested = $state<SchemaCustomRoom[] | null>(null);
	#suggesting = '';

	/** Найденные сообщения (GET /chat/search); null — не искали. */
	found = $state<SchemaChatSearchHit[] | null>(null);
	searching = $state(false);
	/** Открыт поиск по текущей комнате. */
	roomSearch = $state(false);

	current = $state<RoomMeta | null>(null);
	/** Состояние открытой комнаты для меня (GET /chat/{kind}/{slug}); me — null у гостя. */
	info = $state<SchemaChatRoomInfo | null>(null);
	/** Последнее прочитанное на момент открытия: после него — разделитель «Новые». */
	readMark = $state<string | null>(null);
	messages = $state<Item[]>([]);
	/** Курсор старых сообщений; null — это начало истории. */
	nextBefore = $state<string | null>(null);
	historyLoading = $state(false);
	historyError = $state('');
	/** Комнаты нет на бэкенде (404): системный чат ещё не заведён — об этом и пишем. */
	missing = $state(false);
	replyTo = $state<Message | null>(null);

	toasts = $state<Toast[]>([]);

	#seq = 0;
	#readTimer: ReturnType<typeof setTimeout> | null = null;
	#readSent = new Map<string, string>();
	#restored = false;

	get unread(): number {
		return (this.chats ?? []).reduce((sum, c) => sum + (c.muted ? 0 : c.unread), 0);
	}

	/** Непрочитанное одной комнаты; заглушённая — ноль, как и в общем счётчике. */
	unreadOf(room: string): number {
		const chat = this.summary(room);
		return !chat || chat.muted ? 0 : chat.unread;
	}

	/** Непрочитанное по вкладкам: иначе общий счётчик указывает в никуда. */
	get unreadByTab(): Record<Tab, number> {
		return {
			catalog: TOPICS.reduce((sum, t) => sum + this.unreadOf(systemMeta(t.slug).room), 0),
			channels: (this.chats ?? []).reduce(
				(sum, c) => sum + (c.kind === 'dm' || c.custom?.system || c.muted ? 0 : c.unread),
				0
			),
			// Личные переписки появятся вместе с бэкендом: kind === 'dm'.
			dm: (this.chats ?? []).reduce(
				(sum, c) => sum + (c.kind === 'dm' && !c.muted ? c.unread : 0),
				0
			)
		};
	}

	/** Вкладка: «Общий» и «Каталог» сразу показывают ленту, «Комнаты» — список. */
	setTab(tab: Tab) {
		this.tab = tab;
		this.adhoc = null;
		if (tab === 'catalog') this.#enter(systemMeta(this.topic));
		else this.#leave();
	}

	setTopic(topic: Topic) {
		this.topic = topic;
		this.tab = 'catalog';
		this.adhoc = null;
		this.#enter(systemMeta(topic));
	}

	setListView(view: ListView) {
		this.listView = view;
		this.#save();
	}

	/** Назад из комнаты, открытой поверх вкладки. */
	back() {
		this.adhoc = null;
		this.setTab(this.tab);
	}

	/** Кого подсказывать по «@»: те, чьи сообщения уже в ленте. */
	get participants(): SchemaUserRef[] {
		const seen: SchemaUserRef[] = [];
		for (const m of this.messages)
			if (m.author && !seen.some((u) => u.id === m.author!.id)) seen.push(m.author);
		return seen;
	}

	summary(room: string) {
		return this.chats?.find((c) => c.room === room);
	}

	muted(room: string): boolean {
		const me = this.info?.room === room ? this.info.me : null;
		return this.summary(room)?.muted ?? me?.muted ?? false;
	}

	/** Комната и так в подписках (интерес или вступил): отдельный subscribe не нужен. */
	get member(): boolean {
		return !!this.current && this.info?.room === this.current.room && !!this.info.me?.member;
	}

	/** Состояние из localStorage — один раз, в браузере. */
	restore() {
		if (!browser || this.#restored) return;
		this.#restored = true;
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE) ?? '{}');
			this.collapsed = !!saved.collapsed;
			this.topic = topicOf(saved.topic);
			this.tab = TABS.includes(saved.tab) ? saved.tab : 'catalog';
			this.listView = saved.list === 'live' ? 'live' : 'mine';
			if (saved.open?.room) this.open(saved.open, { show: false });
			else this.setTab(this.tab);
		} catch {
			// localStorage недоступен — панель по умолчанию
			this.setTab('catalog');
		}
	}

	#save() {
		try {
			localStorage.setItem(
				STORAGE,
				JSON.stringify({
					collapsed: this.collapsed,
					tab: this.tab,
					topic: this.topic,
					list: this.listView,
					open: this.adhoc && { ...this.adhoc }
				})
			);
		} catch {
			// не сохранили — не страшно
		}
	}

	/** Кнопка в шапке: на десктопе сворачивает панель, уже — открывает лист. */
	toggle() {
		const mobile = typeof matchMedia !== 'undefined' && !matchMedia('(min-width: 64rem)').matches;
		if (mobile) this.sheet = !this.sheet;
		else this.toggleCollapsed();
	}

	toggleCollapsed() {
		this.collapsed = !this.collapsed;
		this.#save();
	}

	/** Открыть комнату поверх вкладки: с карточки, из списка комнат, из уведомления. */
	open(meta: RoomMeta, { show = true } = {}) {
		this.adhoc = meta;
		this.#enter(meta, show);
	}

	#enter(meta: RoomMeta, show = false) {
		if (show) {
			this.collapsed = false;
			this.sheet = true;
		}
		if (this.current?.room !== meta.room) {
			this.current = meta;
			this.messages = [];
			this.nextBefore = null;
			this.replyTo = null;
			this.info = null;
			this.readMark = null;
			this.missing = false;
			this.roomSearch = false;
			this.clearSearch();
			void this.loadInfo();
			void this.loadHistory();
		}
		this.toasts = this.toasts.filter((t) => t.meta.room !== meta.room);
		this.#save();
	}

	/** Состояние комнаты: шапка, заглушение, участие, последнее прочитанное. */
	async loadInfo() {
		const meta = this.current;
		if (!meta) return;
		try {
			const info = await unwrap(
				client().social.GET('/api/v1/social/chat/{kind}/{slug}', {
					params: { path: splitRoom(meta.room) }
				})
			);
			if (this.current?.room !== meta.room) return;
			this.info = info;
			this.readMark = info.me?.last_read_id ?? null;
			this.current = roomMeta(info);
			this.#save();
		} catch {
			// без состояния — шапка из того, что передали при открытии
		}
	}

	/** Закрыть открытую комнату (вкладка «Комнаты» — к списку). */
	close() {
		this.adhoc = null;
		this.#leave();
	}

	#leave() {
		this.info = null;
		this.readMark = null;
		this.current = null;
		this.messages = [];
		this.replyTo = null;
		this.#save();
	}

	async loadChats() {
		if (session.status !== 'authed') {
			this.chats = null;
			return;
		}
		this.chatsLoading = true;
		try {
			this.chats = await unwrap(api.social.GET('/api/v1/social/chats'));
			this.chatsError = '';
		} catch (e) {
			this.chatsError = errorMessage(e);
		} finally {
			this.chatsLoading = false;
		}
	}

	/** Вкладка «Обсуждается»: активные комнаты, при запросе — поиск по названию и описанию. */
	async loadSuggested(q = '') {
		if (this.#suggesting === `q:${q}`) return;
		this.#suggesting = `q:${q}`;
		try {
			const page = await unwrap(
				guestApi.social.GET('/api/v1/social/chat/rooms', {
					params: { query: { limit: 20, sort: 'active', q: q || undefined } }
				})
			);
			if (this.#suggesting === `q:${q}`) this.suggested = page.items;
		} catch {
			if (this.#suggesting === `q:${q}`) this.suggested = [];
		} finally {
			if (this.#suggesting === `q:${q}`) this.#suggesting = '';
		}
	}

	/**
	 * Поиск по сообщениям: без комнаты — по всем моим чатам (нужен вход), с комнатой — по ней
	 * одной, и это доступно гостю. Пустой запрос сбрасывает выдачу.
	 */
	async searchMessages(q: string, room?: string) {
		const query = q.trim();
		if (!query || (!room && session.status !== 'authed')) {
			this.found = null;
			this.searching = false;
			return;
		}
		this.searching = true;
		try {
			const page = await unwrap(
				client().social.GET('/api/v1/social/chat/search', {
					params: { query: { q: query, room, limit: 20 } }
				})
			);
			this.found = page.items;
		} catch {
			this.found = [];
		} finally {
			this.searching = false;
		}
	}

	/** Закрыть выдачу поиска по комнате. */
	clearSearch() {
		this.found = null;
		this.searching = false;
	}

	/** Шапка комнаты по её имени: из «моих чатов», иначе — хотя бы slug. */
	metaFor(room: string): RoomMeta {
		const summary = this.summary(room);
		if (summary) return roomMeta(summary);
		const { kind, slug } = splitRoom(room);
		return { room, title: slug, href: kind === 'room' ? '/chat' : null, image: null };
	}

	/** История: без older — заново (последние), с older — страница старше уже показанных. */
	async loadHistory(older = false) {
		const meta = this.current;
		if (!meta || (older && !this.nextBefore)) return;
		const { kind, slug } = splitRoom(meta.room);
		this.historyLoading = true;
		this.historyError = '';
		try {
			const page = await unwrap(
				client().social.GET('/api/v1/social/chat/{kind}/{slug}/messages', {
					params: {
						path: { kind, slug },
						query: { limit: HISTORY_PAGE, before: older ? this.nextBefore! : undefined }
					}
				})
			);
			if (this.current?.room !== meta.room) return;
			if (older) this.messages = [...page.items, ...this.messages];
			else {
				// Свои неотправленные остаются в конце ленты.
				const pending = this.messages.filter((m) => m.clientId);
				this.messages = [...page.items, ...pending];
			}
			this.nextBefore = page.next_before ?? null;
		} catch (e) {
			if (this.current?.room === meta.room) {
				// 404 — комнаты просто нет: «Повторить» не поможет, нужен другой текст.
				if (e instanceof ApiError && e.status === 404) this.missing = true;
				else this.historyError = errorMessage(e);
			}
		} finally {
			if (this.current?.room === meta.room) this.historyLoading = false;
		}
	}

	/** Отправить текст в открытую комнату. false — нечего отправлять. */
	send(text: string): boolean {
		const body = text.trim();
		const meta = this.current;
		const me = session.user;
		if (!body || !meta || !me) return false;
		const clientId = `tmp-${++this.#seq}`;
		const item: Item = {
			id: clientId,
			clientId,
			kind: splitRoom(meta.room).kind,
			target_id: '',
			author: {
				id: me.id,
				username: me.username,
				display_name: me.display_name,
				avatar_url: me.avatar_url
			},
			body,
			reply_to: this.replyTo?.id ?? null,
			created_at: new Date().toISOString(),
			deleted: false,
			status: 'sending'
		};
		this.messages = [...this.messages, item];
		this.replyTo = null;
		this.#transmit(meta.room, item);
		return true;
	}

	retry(clientId: string) {
		const item = this.messages.find((m) => m.clientId === clientId);
		if (!item || !this.current) return;
		item.status = 'sending';
		item.error = undefined;
		item.retryAt = undefined;
		this.#transmit(this.current.room, item);
	}

	discard(clientId: string) {
		this.messages = this.messages.filter((m) => m.clientId !== clientId);
	}

	#transmit(room: string, item: Item) {
		const sent = sendRealtime({
			type: 'chat.send',
			room,
			body: item.body,
			reply_to: item.reply_to ?? null,
			client_id: item.clientId
		});
		if (!sent) this.#fail(item.clientId!, 'Нет соединения');
	}

	#fail(clientId: string, error: string, retryAfter?: number) {
		const item = this.messages.find((m) => m.clientId === clientId);
		if (!item) return;
		item.status = 'failed';
		item.error = error;
		item.retryAt = retryAfter ? Date.now() + retryAfter * 1000 : undefined;
	}

	/** Ответ сервера на chat.send. */
	onReply(reply: ReplyMessage) {
		const clientId = typeof reply.client_id === 'string' ? reply.client_id : null;
		if (reply.type === 'chat.sent' && clientId) {
			const message = reply.message as Message;
			const room = String(reply.room);
			if (this.current?.room === room) {
				const known = this.messages.some((m) => m.id === message.id);
				this.messages = known
					? this.messages.filter((m) => m.clientId !== clientId)
					: this.messages.map((m) => (m.clientId === clientId ? message : m));
			}
			this.#bump(room, message, false);
			this.#joinAfterWriting(room);
		} else if (reply.type === 'error' && clientId) {
			const retry = typeof reply.retry_after === 'number' ? reply.retry_after : undefined;
			this.#fail(clientId, sendError(String(reply.error)), retry);
		}
	}

	/** Событие реалтайма: только chat.* и интересы. */
	onEvent(event: RealtimeEvent) {
		const data = event.data;
		switch (event.event) {
			case 'chat.message.created': {
				const message = data.message as Message;
				const room = event.channels.find((c) => !c.startsWith('user:'));
				if (!room) return;
				const mine = message.author?.id === session.user?.id;
				const here = this.current?.room === room;
				if (here && !this.messages.some((m) => m.id === message.id))
					this.messages = [...this.messages, message];
				this.#bump(room, message, !mine && !(here && this.watching));
				if (!mine && !this.muted(room) && !(here && this.watching)) this.#toast(room, message);
				break;
			}
			case 'chat.message.updated':
			case 'chat.message.deleted':
				void this.#refetch(String(data.message_id));
				break;
			case 'chat.read': {
				// Прочитано здесь или на другом устройстве — уведомления снимаем везде.
				const chat = this.chats?.find(
					(c) => c.kind === data.kind && targetId(c) === data.target_id
				);
				if (chat) this.#markRead(chat.room);
				break;
			}
			case 'chat.mention': {
				// В личном канале имени комнаты нет — ищем её по kind и target_id.
				const summary = this.chats?.find(
					(c) => c.kind === data.kind && targetId(c) === data.target_id
				);
				const message = data.message as Message;
				if (!summary || this.current?.room === summary.room) return;
				// Упоминание — личное: показываем даже в заглушённой комнате.
				this.#toast(summary.room, message, true);
				break;
			}
			case 'chat.room.created':
				// Канал rooms: каталог «Обсуждается» перечитываем, список своих чатов не меняется.
				this.suggested = null;
				void this.loadSuggested();
				break;
			case 'chat.room.deleted': {
				const gone = this.chats?.find((c) => c.custom?.id === data.room_id);
				if (gone && this.current?.room === gone.room) this.close();
				void this.loadChats();
				break;
			}
			case 'chat.room.updated':
			case 'interest.added':
			case 'interest.removed':
				void this.loadChats();
				break;
		}
	}

	/** Переподключились или lagged: пропущенное не придёт — перечитать. */
	resync() {
		void this.loadChats();
		void this.loadInfo();
		void this.loadHistory();
	}

	/** Панель показывает открытую комнату (не свёрнута, не скрыт лист, вкладка видна). */
	get watching(): boolean {
		if (typeof document !== 'undefined' && document.hidden) return false;
		const mobile = typeof matchMedia !== 'undefined' && !matchMedia('(min-width: 64rem)').matches;
		return mobile ? this.sheet : !this.collapsed;
	}

	/** Новое сообщение комнаты: последнее в строке, комната наверх, unread + 1. */
	#bump(room: string, message: Message, unread: boolean) {
		if (!this.chats) return;
		const chat = this.chats.find((c) => c.room === room);
		if (!chat) {
			// Комнаты нет в списке (интерес добавлен только что) — список перечитаем.
			if (unread) void this.loadChats();
			return;
		}
		chat.last_message = message;
		if (unread) chat.unread = Math.min(100, chat.unread + 1);
		this.chats = [chat, ...this.chats.filter((c) => c !== chat)];
	}

	#toast(room: string, message: Message, mention = false) {
		const chat = this.summary(room);
		const meta = chat ? roomMeta(chat) : this.current?.room === room ? this.current : null;
		if (!meta) return;
		const toast = { id: message.id, meta, message, mention };
		this.toasts = [...this.toasts.slice(-2), toast];
		setTimeout(() => (this.toasts = this.toasts.filter((t) => t !== toast)), TOAST_MS);
	}

	dismiss(id: string) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	async #refetch(id: string) {
		const shown = this.messages.some((m) => m.id === id);
		const last = this.chats?.find((c) => c.last_message?.id === id);
		if (!shown && !last) return;
		try {
			const message = await unwrap(
				client().social.GET('/api/v1/social/chat/messages/{id}', { params: { path: { id } } })
			);
			this.#replace(message);
		} catch {
			// не перечитали — останется старая версия до следующей синхронизации
		}
	}

	#replace(message: Message) {
		this.messages = this.messages.map((m) => (m.id === message.id ? message : m));
		for (const c of this.chats ?? [])
			if (c.last_message?.id === message.id) c.last_message = message;
	}

	/**
	 * «Прочитать всё»: системные чаты у всех общие, и в них копится история, которую человек
	 * не открывал. Отмечаем прочитанным последнее сообщение каждого чата со счётчиком.
	 */
	readAll() {
		for (const c of this.chats ?? []) {
			const id = c.last_message?.id;
			if (!c.unread || !id) continue;
			if (sendRealtime({ type: 'chat.read', room: c.room, message_id: id })) {
				this.#readSent.set(c.room, id);
				this.#markRead(c.room);
			}
		}
	}

	/** Комната прочитана: счётчик обнуляем и убираем её уведомления — они уже не новости. */
	#markRead(room: string) {
		const chat = this.summary(room);
		if (chat) chat.unread = 0;
		this.toasts = this.toasts.filter((t) => t.meta.room !== room);
	}

	/** Последнее сообщение комнаты видно: через паузу — chat.read и unread = 0. */
	seen(messageId: string) {
		const room = this.current?.room;
		if (!room || session.status !== 'authed' || this.#readSent.get(room) === messageId) return;
		// Панель скрыта (лист закрыт, свёрнута, вкладка в фоне) — пользователь ничего не видел.
		if (!this.watching) return;
		if (this.#readTimer) clearTimeout(this.#readTimer);
		this.#readTimer = setTimeout(() => {
			this.#readTimer = null;
			if (this.current?.room !== room || !this.watching) return;
			if (sendRealtime({ type: 'chat.read', room, message_id: messageId })) {
				this.#readSent.set(room, messageId);
				this.#markRead(room);
			}
		}, READ_DELAY_MS);
	}

	/** Заглушить или вернуть уведомления: открытой комнаты или любой строки списка. */
	async toggleMute(target?: string) {
		const room = target ?? this.current?.room;
		if (!room) return;
		const next = !this.muted(room);
		const params = { path: splitRoom(room) };
		try {
			await unwrap(
				next
					? api.social.PUT('/api/v1/social/chat/{kind}/{slug}/mute', { params })
					: api.social.DELETE('/api/v1/social/chat/{kind}/{slug}/mute', { params })
			);
			const chat = this.summary(room);
			if (chat) chat.muted = next;
			if (this.info?.room === room && this.info.me) this.info.me.muted = next;
		} catch (e) {
			this.historyError = errorMessage(e);
		}
	}

	/** «Следить» / «Вступить» из шапки комнаты: интерес или участие в комнате админа. */
	async toggleMember() {
		const info = this.info;
		if (!info?.me || this.current?.room !== info.room) return;
		await this.#setMember(info.room, !info.me.member);
	}

	async #setMember(room: string, next: boolean) {
		const { kind, slug } = splitRoom(room);
		// Личная переписка не «комната, в которую вступают»: её убирают крестиком.
		if (kind === 'dm') return;
		const params = { path: { slug } };
		// Пути интересов и участия устроены одинаково: PUT / DELETE, 204.
		const path = (
			kind === 'room'
				? '/api/v1/social/chat/rooms/{slug}/membership'
				: `/api/v1/social/${{ entity: 'entities', person: 'people', tag: 'tags' }[kind]}/{slug}/interest`
		) as '/api/v1/social/entities/{slug}/interest';
		try {
			await unwrap(next ? api.social.PUT(path, { params }) : api.social.DELETE(path, { params }));
			if (this.info?.room === room && this.info.me) this.info.me.member = next;
			void this.loadChats();
		} catch (e) {
			this.historyError = errorMessage(e);
		}
	}

	/**
	 * Открыть личную переписку с человеком, создав её при первом обращении.
	 * Эндпоинта пока нет на бэкенде — до выката кнопка «Написать» честно говорит об этом.
	 */
	async openDm(user: SchemaUserRef) {
		try {
			const info = (await unwrap(
				api.social.PUT(
					'/api/v1/social/users/{username}/dm' as '/api/v1/social/users/{username}/follow',
					{ params: { path: { username: user.username } } }
				)
			)) as unknown as SchemaChatRoomInfo;
			this.tab = 'dm';
			this.info = info;
			this.open(roomMeta(info));
			void this.loadChats();
		} catch (e) {
			if (!(e instanceof ApiError)) throw e;
			const text =
				e.status === 404 || e.status === 405
					? 'Личные сообщения ещё не включены.'
					: e.code === 'blocked'
						? 'Этот человек недоступен для переписки.'
						: e.code === 'dm_closed'
							? 'Человек не принимает сообщения от незнакомых.'
							: null;
			throw text ? new Error(text, { cause: e }) : e;
		}
	}

	/** Крестик в списке: перестать следить за карточкой, человеком, темой или выйти из комнаты. */
	async leave(room: string) {
		await this.#setMember(room, false);
	}

	/**
	 * Убрать общий чат из «Моих чатов» или вернуть обратно. Сам чат остаётся рабочим:
	 * открывается вкладкой, канал подписан, упоминания приходят. Только для системных —
	 * из остальных можно выйти, а вернуть их из интерфейса было бы нечем.
	 */
	async setHidden(room: string, next: boolean) {
		const { slug } = splitRoom(room);
		const params = { path: { slug } };
		try {
			await unwrap(
				next
					? api.social.PUT('/api/v1/social/chat/rooms/{slug}/hidden', { params })
					: api.social.DELETE('/api/v1/social/chat/rooms/{slug}/hidden', { params })
			);
			if (this.info?.room === room && this.info.custom) this.info.custom.hidden = next;
			await this.loadChats();
		} catch (e) {
			this.historyError = errorMessage(e);
		}
	}

	/** Открытый чат убран из списка: показываем, как вернуть. */
	get currentHidden(): boolean {
		return !!this.current && this.info?.room === this.current.room && !!this.info.custom?.hidden;
	}

	/**
	 * Написал в чужой чат — он становится своим: попадает в панель, подписывается на события
	 * и считает непрочитанное. Иначе разговор теряется, как только закроешь комнату.
	 */
	#joinAfterWriting(room: string) {
		// Убранный чат возвращается в список тем же правилом: написал — значит он твой.
		if (this.info?.room === room && this.info.custom?.hidden) void this.setHidden(room, false);
		const info = this.info;
		if (!info || info.room !== room || !info.me || info.me.member) return;
		void this.#setMember(room, true);
	}

	/** Правка своего сообщения. Ошибка — исключение: форма правки покажет её. */
	async edit(id: string, body: string) {
		const message = await unwrap(
			api.social.PATCH('/api/v1/social/chat/messages/{id}', {
				params: { path: { id } },
				body: { body: body.trim() }
			})
		);
		this.#replace(message);
	}

	async remove(id: string) {
		await unwrap(
			api.social.DELETE('/api/v1/social/chat/messages/{id}', { params: { path: { id } } })
		);
		const message = this.messages.find((m) => m.id === id);
		if (message) this.#replace({ ...message, deleted: true, author: null, body: null });
	}
}

export const chat = new Chat();
