// Лайки и дизлайки рецензий. Свои голоса — один запрос на карточку (GET …/votes/mine), общий на
// страницу (MyVotes в контексте): рецензии — публичные данные без токена, личное — отдельно.
// Голос — PUT …/vote, снять — DELETE; счётчики после голоса — из ответа.
import { getContext, setContext } from 'svelte';
import { unwrap } from '#lib/api/errors.ts';
import { api, session } from '#lib/auth/session.svelte.ts';
import type { Vote } from './reviews.ts';

const KEY = Symbol('my-votes');

/** Свои голоса за рецензии одной сущности. Создавать при инициализации страницы. */
export class MyVotes {
	/** id рецензии → свой голос. */
	votes = $state<Record<string, Vote>>({});

	/** slug: null — сущность неизвестна (профиль, лента): свои голоса не грузим, голосовать можно. */
	constructor(slug: () => string | null) {
		$effect(() => {
			// Новая карточка или вход/выход — перечитать.
			const current = slug();
			const authed = session.status === 'authed';
			this.votes = {};
			if (!current || !authed) return;
			let stale = false;
			unwrap(
				api.social.GET('/api/v1/social/entities/{slug}/votes/mine', {
					params: { path: { slug: current } }
				})
			)
				.then((votes) => {
					if (stale) return;
					const own: Record<string, Vote> = {};
					for (const [id, v] of Object.entries(votes ?? {})) if (v === 1 || v === -1) own[id] = v;
					this.votes = own;
				})
				// Не узнали свои голоса — кнопки просто не подсвечены; голосовать это не мешает.
				.catch(() => {});
			return () => {
				stale = true;
			};
		});
	}

	/** Поставить (или снять, если value совпал) голос. Возвращает счётчики и голос из ответа. */
	async send(reviewId: string, value: Vote | null) {
		const params = { path: { id: reviewId } };
		const result = await unwrap(
			value === null
				? api.social.DELETE('/api/v1/social/reviews/{id}/vote', { params })
				: api.social.PUT('/api/v1/social/reviews/{id}/vote', { params, body: { value } })
		);
		const vote = result.value === 1 || result.value === -1 ? result.value : null;
		this.set(reviewId, vote);
		return { likes: result.likes_count, dislikes: result.dislikes_count, vote };
	}

	set(reviewId: string, vote: Vote | null) {
		if (vote) this.votes[reviewId] = vote;
		else delete this.votes[reviewId];
	}
}

/** Общие голоса на страницу — для всех ReviewActions ниже. */
export function provideMyVotes(slug: () => string | null): MyVotes {
	return setContext(KEY, new MyVotes(slug));
}

/** Голоса страницы; вне карточки (профиль, лента) — свои, без загрузки. */
export function useMyVotes(): MyVotes {
	return getContext<MyVotes | undefined>(KEY) ?? new MyVotes(() => null);
}
