// Ошибки API. Бэкенд всегда отвечает {"error": "..."} — текст на английском и без кодов,
// поэтому известные сообщения переводим словарём, остальные — по HTTP-статусу.

export class ApiError extends Error {
	/** HTTP-статус; 0 — запрос не дошёл до сервера. */
	readonly status: number;
	/** Сообщение бэкенда как есть (для логики и логов). */
	readonly serverMessage: string | null;

	constructor(status: number, serverMessage: string | null) {
		super(translate(status, serverMessage));
		this.name = 'ApiError';
		this.status = status;
		this.serverMessage = serverMessage;
	}
}

const KNOWN: [RegExp, string][] = [
	[/^email not verified$/, 'Email не подтверждён. Перейдите по ссылке из письма.'],
	[/^invalid or expired token$/, 'Ссылка недействительна или устарела. Запросите новую.'],
	[/email already registered/, 'Этот email уже зарегистрирован.'],
	[/username already taken/, 'Это имя пользователя уже занято.'],
	[/^username must be/, 'Имя пользователя: 3–32 символа, латиница, цифры, «_», «-», «.».'],
	[/^username can be changed once/, 'Имя пользователя можно менять раз в 30 дней.'],
	[/^password must be/, 'Пароль должен быть от 8 до 128 символов.'],
	[/^current password is incorrect$/, 'Текущий пароль неверен.'],
	[/^password is incorrect$/, 'Пароль неверен.'],
	[/^password is required$/, 'Введите пароль.'],
	[/^this is already your email$/, 'Это и так ваш email.'],
	[/^invalid email/, 'Некорректный email.'],
	[/^display_name must be/, 'Имя — не длиннее 64 символов.'],
	[/^avatar_url must be/, 'Аватар — ссылка https:// не длиннее 500 символов.']
];

const BY_STATUS: Record<number, string> = {
	0: 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
	400: 'Проверьте введённые данные.',
	401: 'Нужно войти.',
	403: 'Недостаточно прав.',
	404: 'Не найдено.',
	409: 'Уже занято.',
	429: 'Слишком много попыток. Подождите немного и попробуйте снова.'
};

export function translate(status: number, serverMessage: string | null): string {
	if (serverMessage) {
		const known = KNOWN.find(([re]) => re.test(serverMessage));
		if (known) return known[1];
	}
	if (status >= 500) return 'Ошибка сервера. Попробуйте позже.';
	return BY_STATUS[status] ?? 'Что-то пошло не так. Попробуйте ещё раз.';
}

/** Текст для пользователя из любой ошибки: ApiError, сбой сети или исключение в коде. */
export function errorMessage(e: unknown): string {
	if (e instanceof ApiError) return e.message;
	return BY_STATUS[0];
}

function serverMessageOf(body: unknown): string | null {
	if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
		return body.error;
	}
	return null;
}

/**
 * Результат вызова openapi-fetch → данные или ApiError. Сбой сети тоже становится ApiError(0).
 *
 * ```ts
 * const user = await unwrap(api.auth.GET('/api/v1/auth/me'));
 * ```
 */
export async function unwrap<T>(
	call: Promise<{ data?: T; error?: unknown; response: Response }>
): Promise<T> {
	let result;
	try {
		result = await call;
	} catch (e) {
		if (e instanceof ApiError) throw e;
		throw new ApiError(0, null);
	}
	if (!result.response.ok) {
		throw new ApiError(result.response.status, serverMessageOf(result.error));
	}
	return result.data as T;
}
