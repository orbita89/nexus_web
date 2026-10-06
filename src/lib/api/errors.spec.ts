import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage, translate, unwrap } from './errors';

describe('translate', () => {
	it('переводит известные сообщения бэкенда', () => {
		expect(translate(403, 'email not verified')).toMatch(/не подтверждён/);
		expect(translate(409, 'conflict: email already registered')).toMatch(/уже зарегистрирован/);
		expect(translate(409, 'conflict: username already taken')).toMatch(/занято/);
	});

	it('неизвестное сообщение — текст по статусу', () => {
		expect(translate(429, 'too many requests, try again later')).toMatch(/Слишком много/);
		expect(translate(502, null)).toMatch(/Ошибка сервера/);
		expect(translate(418, 'teapot')).toMatch(/Что-то пошло не так/);
	});
});

describe('unwrap', () => {
	const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null) });

	it('возвращает данные', async () => {
		await expect(unwrap(ok({ a: 1 }))).resolves.toEqual({ a: 1 });
	});

	it('ошибка API → ApiError со статусом и сообщением', async () => {
		const call = Promise.resolve({
			error: { error: 'invalid or expired token' },
			response: new Response(null, { status: 400 })
		});
		const e = await unwrap(call).catch((e: unknown) => e);
		expect(e).toBeInstanceOf(ApiError);
		expect(e).toMatchObject({ status: 400, serverMessage: 'invalid or expired token' });
		expect(errorMessage(e)).toMatch(/Ссылка недействительна/);
	});

	it('сбой сети → ApiError(0)', async () => {
		const e = await unwrap(Promise.reject(new TypeError('Failed to fetch'))).catch((e) => e);
		expect(e).toMatchObject({ status: 0 });
		expect(errorMessage(e)).toMatch(/Нет связи/);
	});
});
