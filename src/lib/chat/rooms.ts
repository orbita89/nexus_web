// Имена комнат чата и их подписи — без Svelte, чтобы проверялось unit-тестами.
// Комната — строка `<kind>:<slug>`, одна и та же в WebSocket, событиях и GET /chats.
import type { SchemaEntityKind } from '#lib/api/generated/catalog.ts';
import type {
	SchemaChatRoomInfo,
	SchemaChatSummary,
	SchemaCustomRoom,
	SchemaUserRef
} from '#lib/api/generated/social.ts';
import { ApiError, errorMessage } from '#lib/api/errors.ts';
import { KINDS, kindBySlug, refHref } from '#lib/catalog/kinds.ts';

export type RoomKind = 'entity' | 'person' | 'tag' | 'room' | 'dm';

// Системные чаты. Вкладка панели — сам чат, а не список чатов: «Общий» открывает ленту
// сразу, «Каталог» переключает между лентами по разделам. Заведены на бэкенде, участие
// у всех по умолчанию.
export const GENERAL = 'general';

/** Чипы вкладки «Каталог»: общий разговор и по одному чату на раздел каталога. */
export const TOPICS = [
	{ slug: GENERAL, title: 'Общий' },
	{ slug: 'movies', title: 'Кино' },
	{ slug: 'series', title: 'Сериалы' },
	{ slug: 'books', title: 'Книги' },
	{ slug: 'games', title: 'Игры' }
] as const;

export type Topic = (typeof TOPICS)[number]['slug'];

export const topicOf = (value: string | null | undefined): Topic =>
	TOPICS.find((t) => t.slug === value)?.slug ?? GENERAL;

const SYSTEM = [{ slug: GENERAL, title: 'Общий чат' }, ...TOPICS.filter((t) => t.slug !== GENERAL)];

/** Шапка системного чата: ссылки на карточку у него нет. */
export function systemMeta(slug: string): RoomMeta {
	const room = SYSTEM.find((r) => r.slug === slug);
	return { room: `room:${slug}`, title: room?.title ?? slug, href: null, image: null };
}

/** Системная комната — у неё своя вкладка, поэтому в списке комнат её не показываем. */
export const isSystemRoom = (room: string) => SYSTEM.some((r) => `room:${r.slug}` === room);

/** То, что панели нужно для шапки комнаты: открыть её можно и не из списка (кнопка на карточке). */
export interface RoomMeta {
	room: string;
	title: string;
	/** Ссылка на карточку, человека, тег; у комнаты админа — каталог комнат. */
	href: string | null;
	image: string | null;
}

export function splitRoom(room: string): { kind: RoomKind; slug: string } {
	const i = room.indexOf(':');
	return { kind: room.slice(0, i) as RoomKind, slug: room.slice(i + 1) };
}

/** Шапка комнаты — из строки «Моих чатов» или из состояния комнаты (GET /chat/{kind}/{slug}). */
export function roomMeta(chat: SchemaChatSummary | SchemaChatRoomInfo): RoomMeta {
	const { room } = chat;
	if (chat.entity)
		return {
			room,
			title: chat.entity.title,
			href: refHref(chat.entity),
			image: chat.entity.cover_url ?? null
		};
	if (chat.person)
		return {
			room,
			title: chat.person.full_name,
			href: `/people/${chat.person.slug}`,
			image: chat.person.photo_url ?? null
		};
	// Личная переписка: в шапке — собеседник. Поле появится вместе с бэкендом.
	const dm = (chat as { dm?: { peer: SchemaUserRef } | null }).dm;
	if (dm)
		return {
			room,
			title: authorName(dm.peer),
			href: `/u/${dm.peer.username}`,
			image: dm.peer.avatar_url ?? null
		};
	if (chat.tag) return { room, title: chat.tag.name, href: `/tags/${chat.tag.slug}`, image: null };
	if (chat.custom) return { room, title: chat.custom.title, href: '/chat', image: null };
	return { room, title: splitRoom(room).slug, href: null, image: null };
}

/** Значок непрочитанного: 100 и больше — «99+». */
export const unreadLabel = (n: number) => (n > 99 ? '99+' : String(n));

/** Текст отказа на попытку написать лично. */
export function dmError(e: unknown): string {
	const code = e instanceof ApiError ? e.code : null;
	switch (code) {
		case 'dm_self':
			return 'Это вы.';
		case 'blocked':
			return 'С этим человеком переписка недоступна.';
		case 'dm_closed':
			return 'Человек не принимает сообщения от незнакомых.';
		case 'email_not_verified':
			return 'Подтвердите email, чтобы писать личные сообщения.';
		default:
			return errorMessage(e);
	}
}

/**
 * Причина отказа WebSocket-чата: читается после «Не отправлено: », поэтому строчной буквы
 * и без повтора самого «не отправлено».
 */
export function sendError(error: string): string {
	switch (error) {
		case 'too many messages':
			return 'слишком часто, подождите';
		case 'not authenticated':
			return 'нужно войти';
		case 'blocked':
			return 'собеседник недоступен';
		case 'internal error':
			return 'ошибка на сервере';
		default:
			return error || 'сервер отклонил сообщение';
	}
}

/** Текст сообщения после обрезки: 1–2000 символов, как проверяет сервер. */
export const MAX_BODY = 2000;

/** Время в строке списка и у сообщения: сегодня — «14:05», раньше — «12 окт.». */
export function shortTime(iso: string, now = Date.now()): string {
	const date = new Date(iso);
	const today = new Date(now).toDateString() === date.toDateString();
	return today
		? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
		: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** Имя автора сообщения. */
export const authorName = (author: { username: string; display_name?: string | null }) =>
	author.display_name || author.username;

/** Активность комнаты из полей каталога; null — тихо или бэкенд ещё не отдаёт счётчик. */
export function activityLabel(
	room: SchemaCustomRoom | { messages_24h?: number | null; last_message_at?: string | null },
	now = Date.now()
): string | null {
	const { messages_24h, last_message_at } = room as {
		messages_24h?: number | null;
		last_message_at?: string | null;
	};
	const count = messages_24h ?? 0;
	if (!count) return null;
	const last = last_message_at ? Date.parse(last_message_at) : NaN;
	if (!Number.isNaN(last) && now - last < 60 * 60 * 1000) return 'сейчас пишут';
	return `${count} за сутки`;
}

/** Порядок каталога комнат: активные за сутки, по участникам, новые. */
export const ROOM_SORTS = [
	{ value: 'active', title: 'Активные' },
	{ value: 'members', title: 'Популярные' },
	{ value: 'new', title: 'Новые' }
] as const;

export type RoomSort = (typeof ROOM_SORTS)[number]['value'];

export const roomSort = (value: string | null): RoomSort =>
	ROOM_SORTS.find((s) => s.value === value)?.value ?? 'active';

export type BodyPart = { t: 'text'; v: string } | { t: 'mention'; v: string };

/** Имя пользователя в сообщении: @user. Границей считаем не букву, не цифру и не «_». */
const MENTION = /(^|[^\w@])@([a-zA-Z0-9_]{1,32})/g;

/** Тело сообщения как части: текст и упоминания — чтобы отрисовать ссылки без innerHTML. */
export function parseBody(body: string): BodyPart[] {
	const parts: BodyPart[] = [];
	let at = 0;
	for (const m of body.matchAll(MENTION)) {
		const start = m.index + m[1].length;
		if (start > at) parts.push({ t: 'text', v: body.slice(at, start) });
		parts.push({ t: 'mention', v: m[2] });
		at = start + m[2].length + 1;
	}
	if (at < body.length) parts.push({ t: 'text', v: body.slice(at) });
	return parts;
}

/** Ссылка на карточку внутри сообщения: /films/dune-2021 — чтобы показать превью. */
const ENTITY_LINK = new RegExp(
	`(?:^|\\s|\\()(?:https?://[^\\s/]+)?/(${KINDS.map((k) => k.slug).join('|')})/([a-z0-9][a-z0-9-]*)`,
	'i'
);

export function entityLink(body: string): { kind: SchemaEntityKind; slug: string } | null {
	const m = ENTITY_LINK.exec(body);
	const kind = m && kindBySlug(m[1].toLowerCase());
	return kind ? { kind: kind.kind, slug: m[2].toLowerCase() } : null;
}
