import { describe, expect, it } from 'vitest';
import { bookFile, readAccess } from './access.ts';

describe('readAccess', () => {
	it('публичная — читать всем', () => {
		expect(readAccess(true, 'guest', null)).toBe('read');
		expect(readAccess(true, 'loading', null)).toBe('read');
	});
	it('закрытая: гость — войти, vip/admin — читать, остальные — по приглашению', () => {
		expect(readAccess(false, 'loading', null)).toBe('wait');
		expect(readAccess(false, 'guest', null)).toBe('login');
		expect(readAccess(false, 'authed', 'vip')).toBe('read');
		expect(readAccess(false, 'authed', 'admin')).toBe('read');
		expect(readAccess(false, 'authed', 'user')).toBe('invite');
		expect(readAccess(false, 'authed', 'author')).toBe('invite');
	});
});

describe('bookFile', () => {
	it('файл, публичность и размер из metadata', () => {
		expect(bookFile({ file: { size: 10 }, public_read: true })).toEqual({
			has: true,
			publicRead: true,
			size: 10
		});
		expect(bookFile({})).toEqual({ has: false, publicRead: false, size: null });
	});
});
