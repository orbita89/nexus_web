// Шапка профиля глазами вошедшего. Сервер рендерит профиль как для гостя (токенов на сервере нет),
// поэтому `relation`, `liked` и `blocked` там всегда пустые. Вошедшему шапка перечитывает профиль
// с токеном — одним запросом на обе кнопки, «Подписаться» и «Нравится».
import { errorMessage, unwrap } from '#lib/api/errors.ts';
import type { SchemaSocialProfile } from '#lib/api/generated/social.ts';
import { api, session } from '#lib/auth/session.svelte.ts';

export class ProfileViewer {
	/** null — ещё не знаем: гость, сессия грузится или запрос в пути. */
	profile = $state<SchemaSocialProfile | null>(null);
	error = $state('');

	#username: () => string;

	/** Создавать при инициализации компонента: внутри $effect. */
	constructor(username: () => string) {
		this.#username = username;
		$effect(() => {
			const current = username();
			this.profile = null;
			this.error = '';
			if (session.status !== 'authed') return;
			unwrap(
				api.social.GET('/api/v1/social/users/{username}', {
					params: { path: { username: current } }
				})
			)
				.then((profile) => current === username() && (this.profile = profile))
				.catch((e) => current === username() && (this.error = errorMessage(e)));
		});
	}

	/** Свой ли это профиль: на нём нет ни «Подписаться», ни «Нравится». */
	get own(): boolean {
		return (
			session.status === 'authed' &&
			session.user?.username.toLowerCase() === this.#username().toLowerCase()
		);
	}
}
