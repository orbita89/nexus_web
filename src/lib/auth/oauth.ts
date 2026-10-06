// OAuth: названия провайдеров и тексты ошибок из ?error= (auth.md, «OAuth-провайдеры»).

const TITLES: Record<string, string> = { google: 'Google', github: 'GitHub', yandex: 'Яндекс' };

export function providerTitle(provider: string): string {
	return TITLES[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

const ERRORS: Record<string, string> = {
	access_denied: 'Вход отменён.',
	invalid_state: 'Ссылка для входа устарела. Попробуйте ещё раз.',
	provider_error: 'Провайдер вернул ошибку. Попробуйте ещё раз позже.',
	email_required:
		'Провайдер не передал email. Разрешите доступ к email или войдите другим способом.',
	email_in_use:
		'Аккаунт с этим email уже есть, но провайдер не подтвердил адрес. Войдите по паролю или ссылке из письма и привяжите провайдера в настройках.',
	account_blocked: 'Аккаунт заблокирован.',
	internal_error: 'Ошибка сервера. Попробуйте позже.',
	already_linked: 'Этот аккаунт провайдера уже привязан к другому пользователю.',
	provider_already_linked:
		'У вас уже привязан другой аккаунт этого провайдера. Сначала отвяжите его.'
};

export function oauthErrorMessage(code: string): string {
	return ERRORS[code] ?? 'Не удалось войти через провайдера.';
}

/** Куда вернуться после входа через провайдера: адрес теряется на переходе к нему. */
export const OAUTH_NEXT_KEY = 'nexus.oauth.next';
