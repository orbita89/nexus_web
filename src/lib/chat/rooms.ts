// Имена комнат чата и их подписи — без Svelte, чтобы проверялось unit-тестами.
// Комната — строка `<kind>:<slug>`, одна и та же в WebSocket, событиях и GET /chats.
import type { SchemaChatSummary } from '#lib/api/generated/social.ts';
import { refHref } from '#lib/catalog/kinds.ts';

export type RoomKind = 'entity' | 'person' | 'tag' | 'room';

/** Группы панели «Мои чаты» по виду комнаты. */
export const ROOM_KINDS: readonly { kind: RoomKind; title: string }[] = [
	{ kind: 'entity', title: 'Фильмы и книги' },
	{ kind: 'person', title: 'Люди' },
	{ kind: 'tag', title: 'Темы' },
	{ kind: 'room', title: 'Комнаты' }
];

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

export function roomMeta(chat: SchemaChatSummary): RoomMeta {
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
	if (chat.tag) return { room, title: chat.tag.name, href: `/tags/${chat.tag.slug}`, image: null };
	if (chat.custom) return { room, title: chat.custom.title, href: '/chat', image: null };
	return { room, title: splitRoom(room).slug, href: null, image: null };
}

/** Значок непрочитанного: 100 и больше — «99+». */
export const unreadLabel = (n: number) => (n > 99 ? '99+' : String(n));

/** Текст ошибки WebSocket-чата по коду сервера. */
export function sendError(error: string): string {
	switch (error) {
		case 'too many messages':
			return 'Слишком часто — подождите';
		case 'not authenticated':
			return 'Войдите, чтобы писать';
		default:
			return 'Не отправлено';
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
