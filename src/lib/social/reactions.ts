// Реакции на произведение: любой эмодзи, сколько угодно разных от одного зрителя.
// Счётчики на карточке — GET …/entities/{slug}/reactions (с `mine` у вошедшего), в сводке оценок
// то же самое без «моей» (`reaction_items`). Поставить — PUT {emoji}, снять — DELETE {emoji}.
import type { SchemaReactionKind, SchemaReactionItem } from '#lib/api/generated/social.ts';

export type ReactionItem = SchemaReactionItem;

/**
 * Четыре вида, какими реакции были до перехода на эмодзи. Карточка о них больше не знает, но
 * статистика профиля (`ProfileStats.reactions`) считает по-прежнему их — там это и используем.
 */
export const LEGACY_REACTIONS: readonly {
	key: SchemaReactionKind;
	emoji: string;
	label: string;
}[] = [
	{ key: 'fire', emoji: '🔥', label: 'Огонь' },
	{ key: 'sad', emoji: '😢', label: 'Грустно' },
	{ key: 'think', emoji: '🤔', label: 'Заставляет думать' },
	{ key: 'bored', emoji: '😴', label: 'Скучно' }
];

/** Разных эмодзи на одно произведение (бэкенд: 409 `reaction_limit` сверх этого). */
export const EMOJI_LIMIT = 30;

/** Реакций в строке до «ещё N»: дальше строка превращается в ленту и перестаёт читаться. */
export const SHOWN_REACTIONS = 12;

/**
 * Палитра кнопки «+»: то, чем чаще всего отвечают на фильм, книгу или игру. Не ограничение —
 * бэкенд принимает любой эмодзи, но набор под рукой избавляет от выбора из тысячи.
 */
export const EMOJI_PALETTE: readonly string[] = [
	'❤️',
	'🔥',
	'😂',
	'😭',
	'😢',
	'🤔',
	'🤯',
	'😱',
	'🥰',
	'🤩',
	'👏',
	'👍',
	'👎',
	'😴',
	'🤮',
	'🎬',
	'🎭',
	'🏆',
	'💔',
	'🧠',
	'👀',
	'💀',
	'🍿',
	'⭐'
];

/**
 * Своё нажатие до ответа сервера: новая реакция появляется в конце, снятая с нулём исчезает.
 * Порядок остальных не трогаем — иначе строка прыгает под пальцем.
 */
export function applyReaction(
	items: readonly ReactionItem[],
	emoji: string,
	on: boolean
): ReactionItem[] {
	const found = items.find((i) => i.emoji === emoji);
	if (!found) return on ? [...items, { emoji, count: 1, mine: true }] : [...items];
	return items
		.map((i) =>
			i.emoji === emoji ? { ...i, count: Math.max(0, i.count + (on ? 1 : -1)), mine: on } : { ...i }
		)
		.filter((i) => i.count > 0);
}

/** Своя ли это реакция: по ней решаем, ставим или снимаем. */
export function isMine(items: readonly ReactionItem[], emoji: string): boolean {
	return items.some((i) => i.emoji === emoji && i.mine);
}
