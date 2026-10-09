// Лайки и дизлайки рецензий. API ещё нет (docs/backend-questions.md): свой голос хранится в
// браузере, у каждого пользователя свой (ключ с id); счётчики — из рецензии, если бэкенд их уже
// присылает (likes_count, dislikes_count). Появится API — меняется только этот файл.
import { session } from '#lib/auth/session.svelte.ts';

export type Vote = 1 | -1;

/** Комментарии к рецензиям: появится API — true (ReviewComments перестанет быть заглушкой). */
export const REVIEW_COMMENTS_API = false;

const key = (userId: string) => `nexus.review-votes.${userId}`;

function readAll(userId: string): Record<string, Vote> {
	try {
		return JSON.parse(localStorage.getItem(key(userId)) ?? '{}');
	} catch {
		return {};
	}
}

/** Число из поля рецензии, которого может не быть в контракте: likes_count и т. п. */
export function reviewCount(review: object, field: string): number {
	const value = (review as Record<string, unknown>)[field];
	return typeof value === 'number' && value > 0 ? value : 0;
}

/** Свой голос за одну рецензию. Создавать при инициализации компонента. */
export class ReviewVote {
	vote = $state<Vote | null>(null);

	#id: () => string;

	constructor(id: () => string) {
		this.#id = id;
		$effect(() => {
			const userId = session.user?.id;
			this.vote = userId ? (readAll(userId)[id()] ?? null) : null;
		});
	}

	/** Поставить голос; повторно тот же — снять. */
	toggle(vote: Vote) {
		const userId = session.user?.id;
		if (!userId) return;
		this.vote = this.vote === vote ? null : vote;
		const all = readAll(userId);
		if (this.vote) all[this.#id()] = this.vote;
		else delete all[this.#id()];
		try {
			localStorage.setItem(key(userId), JSON.stringify(all));
		} catch {
			// приватный режим или квота — голос живёт до перезагрузки
		}
	}
}
