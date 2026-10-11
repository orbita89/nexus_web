// Реакции на произведение: 🔥 😢 🤔 😴 — одна на зрителя. Счётчики — RatingSummary.reactions
// (тот же запрос, что и сводка оценок), своя — GET/PUT/DELETE …/entities/{slug}/reaction.
import type { SchemaReactionKind, SchemaReactions } from '#lib/api/generated/social.ts';

export type Reaction = SchemaReactionKind;
export type ReactionCounts = SchemaReactions;

export const REACTIONS: readonly { key: Reaction; emoji: string; label: string }[] = [
	{ key: 'fire', emoji: '🔥', label: 'Огонь' },
	{ key: 'sad', emoji: '😢', label: 'Грустно' },
	{ key: 'think', emoji: '🤔', label: 'Заставляет думать' },
	{ key: 'bored', emoji: '😴', label: 'Скучно' }
];

/** Нажали реакцию: другая заменяет свою (перенос между видами), та же — снимает. */
export function applyReaction(
	counts: ReactionCounts,
	mine: Reaction | null,
	key: Reaction
): { counts: ReactionCounts; mine: Reaction | null } {
	const next = mine === key ? null : key;
	const result = { ...counts };
	if (mine) result[mine] = Math.max(0, result[mine] - 1);
	if (next) result[next] += 1;
	return { counts: result, mine: next };
}
