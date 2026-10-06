// Ошибки API. Бэкенд всегда отвечает {"error": "..."} — текст на английском и без кодов,
// поэтому известные сообщения переводим словарём, остальные — по HTTP-статусу.

export class ApiError extends Error {
	/** HTTP-статус; 0 — запрос не дошёл до сервера. */
	readonly status: number;
	/** Сообщение бэкенда как есть (для логики и логов). */
	readonly serverMessage: string | null;
	/** Для 429: через сколько секунд можно повторить, если бэкенд сказал. */
	readonly retryAfter: number | null;

	constructor(status: number, serverMessage: string | null, retryAfter: number | null = null) {
		super(translate(status, serverMessage, retryAfter));
		this.name = 'ApiError';
		this.status = status;
		this.serverMessage = serverMessage;
		this.retryAfter = retryAfter;
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

/** До двух минут — секунды (80 → «80 с»), дальше — минуты (150 → «3 мин»). */
export function formatWait(seconds: number): string {
	return seconds < 120 ? `${Math.max(1, Math.ceil(seconds))} с` : `${Math.ceil(seconds / 60)} мин`;
}

export function translate(
	status: number,
	serverMessage: string | null,
	retryAfter: number | null = null
): string {
	if (status === 429 && retryAfter !== null) {
		return `Слишком много попыток. Попробуйте через ${formatWait(retryAfter)}.`;
	}
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

/** Секунды до повтора: retry_after из тела, иначе заголовок Retry-After (секунды). */
function retryAfterOf(body: unknown, response: Response): number | null {
	if (body && typeof body === 'object' && 'retry_after' in body) {
		const v = body.retry_after;
		if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
	}
	const header = response.headers.get('Retry-After');
	if (header !== null && /^\d+$/.test(header.trim())) return Number(header.trim());
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
		const { status } = result.response;
		throw new ApiError(
			status,
			serverMessageOf(result.error),
			status === 429 ? retryAfterOf(result.error, result.response) : null
		);
	}
	return result.data as T;
}
