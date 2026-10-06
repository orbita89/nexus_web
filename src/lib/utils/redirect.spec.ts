import { describe, expect, it } from 'vitest';
import { loginUrl, safeNext } from './redirect';

describe('safeNext', () => {
	it('пропускает пути сайта', () => {
		expect(safeNext('/settings/accounts?linked=github')).toBe('/settings/accounts?linked=github');
	});

	it('отбрасывает внешние адреса и пустое', () => {
		for (const bad of [
			'//evil.com',
			'/\\evil.com',
			'https://evil.com',
			'javascript:alert(1)',
			'',
			null
		]) {
			expect(safeNext(bad)).toBe('/');
		}
	});
});

describe('loginUrl', () => {
	it('запоминает страницу с параметрами', () => {
		expect(loginUrl(new URL('http://x/settings/accounts?linked=github'))).toBe(
			'/auth/login?next=%2Fsettings%2Faccounts%3Flinked%3Dgithub'
		);
		expect(loginUrl(new URL('http://x/'))).toBe('/auth/login');
	});
});
