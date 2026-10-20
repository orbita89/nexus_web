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
	SchemaChatSummary
} from '#lib/api/generated/social.ts';
import { errorMessage, unwrap } from '#lib/api/errors.ts';
import { api, guestApi, session } from '#lib/auth/session.svelte.ts';
import type { RealtimeEvent, ReplyMessage } from '#lib/realtime/client.ts';
import { sendRealtime } from '#lib/realtime/realtime.svelte.ts';
import { roomMeta, sendError, splitRoom, type RoomKind, type RoomMeta } from './rooms.ts';

export type Message = SchemaChatMessage;

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
	filter = $state<RoomKind | null>(null);

	/** null — гость или ещё не загружен. */
	chats = $state<SchemaChatSummary[] | null>(null);
	chatsLoading = $state(false);
	chatsError = $state('');

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
	replyTo = $state<Message | null>(null);

	toasts = $state<Toast[]>([]);

	#seq = 0;
	#readTimer: ReturnType<typeof setTimeout> | null = null;
	#readSent = new Map<string, string>();
	#restored = false;

	get unread(): number {
		return (this.chats ?? []).reduce((sum, c) => sum + (c.muted ? 0 : c.unread), 0);
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
			if (saved.open?.room) this.open(saved.open, { show: false });
		} catch {
			// localStorage недоступен — панель по умолчанию
		}
	}

	#save() {
		try {
			localStorage.setItem(
				STORAGE,
				JSON.stringify({ collapsed: this.collapsed, open: this.current && { ...this.current } })
			);
		} catch {
			// не сохранили — не страшно
		}
	}

	toggleCollapsed() {
		this.collapsed = !this.collapsed;
		this.#save();
	}

	/** Открыть комнату в панели (из списка, с карточки, из уведомления). */
	open(meta: RoomMeta, { show = true } = {}) {
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

	/** Назад к списку. */
	close() {
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
			if (this.current?.room === meta.room) this.historyError = errorMessage(e);
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
				this.#bump(room, message, !mine && !(here && this.#watching()));
				if (!mine && !this.muted(room) && !(here && this.#watching())) this.#toast(room, message);
				break;
			}
			case 'chat.message.updated':
			case 'chat.message.deleted':
				void this.#refetch(String(data.message_id));
				break;
			case 'chat.read': {
				const chat = this.chats?.find(
					(c) => c.kind === data.kind && targetId(c) === data.target_id
				);
				if (chat) chat.unread = 0;
				break;
			}
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
	#watching() {
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

	#toast(room: string, message: Message) {
		const chat = this.summary(room);
		const meta = chat ? roomMeta(chat) : this.current?.room === room ? this.current : null;
		if (!meta) return;
		const toast = { id: message.id, meta, message };
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

	/** Последнее сообщение комнаты видно: через паузу — chat.read и unread = 0. */
	seen(messageId: string) {
		const room = this.current?.room;
		if (!room || session.status !== 'authed' || this.#readSent.get(room) === messageId) return;
		if (this.#readTimer) clearTimeout(this.#readTimer);
		this.#readTimer = setTimeout(() => {
			this.#readTimer = null;
			if (this.current?.room !== room) return;
			if (sendRealtime({ type: 'chat.read', room, message_id: messageId })) {
				this.#readSent.set(room, messageId);
				const chat = this.summary(room);
				if (chat) chat.unread = 0;
			}
		}, READ_DELAY_MS);
	}

	async toggleMute() {
		const room = this.current?.room;
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
		const next = !info.me.member;
		const { kind, slug } = splitRoom(info.room);
		const params = { path: { slug } };
		// Пути интересов и участия устроены одинаково: PUT / DELETE, 204.
		const path = (
			kind === 'room'
				? '/api/v1/social/chat/rooms/{slug}/membership'
				: `/api/v1/social/${{ entity: 'entities', person: 'people', tag: 'tags' }[kind]}/{slug}/interest`
		) as '/api/v1/social/entities/{slug}/interest';
		try {
			await unwrap(next ? api.social.PUT(path, { params }) : api.social.DELETE(path, { params }));
			info.me.member = next;
			void this.loadChats();
		} catch (e) {
			this.historyError = errorMessage(e);
		}
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
