// Комментарии к произведениям, людям и студиям: GET/POST /social/comments, DELETE
// /social/comments/{id}. Комментарии к рецензиям и обсуждения подборок живут по своим старым
// адресам — здесь их нет.
//
// Лента плоская, старые сверху, ветка ровно одного уровня: ответ на ответ бэкенд сам привязывает
// к корню, поэтому группируем по parent_id без рекурсии.
import type { SchemaTargetComment } from '#lib/api/generated/social.ts';

/** К чему комментарий: `entity:dune-2021`, `person:denis-villeneuve`, `studio:legendary`. */
export type CommentTargetKind = 'entity' | 'person' | 'studio';

export function commentTarget(kind: CommentTargetKind, slug: string): string {
	return `${kind}:${slug}`;
}

export const COMMENT_BODY_LIMIT = 2000;

/** Лимит бэкенда: 5 комментариев в минуту, дальше 429 с Retry-After: 60. */
export const COMMENT_RATE_WAIT = 60;

export interface CommentThread {
	root: SchemaTargetComment;
	replies: SchemaTargetComment[];
}

/**
 * Плоский список → корни со своими ответами, в том же порядке (старые сверху). Ответ, корень
 * которого не попал на эту страницу, показываем как корневой: иначе он просто пропал бы.
 */
export function threadComments(items: readonly SchemaTargetComment[]): CommentThread[] {
	const threads: CommentThread[] = [];
	const byId = new Map<string, CommentThread>();
	for (const comment of items) {
		if (!comment.parent_id) {
			const thread = { root: comment, replies: [] };
			byId.set(comment.id, thread);
			threads.push(thread);
		}
	}
	for (const comment of items) {
		if (!comment.parent_id) continue;
		const parent = byId.get(comment.parent_id);
		if (parent) parent.replies.push(comment);
		else threads.push({ root: comment, replies: [] });
	}
	return threads;
}
