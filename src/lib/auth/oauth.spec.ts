import { describe, expect, it } from 'vitest';
import { oauthErrorMessage, providerTitle } from './oauth';

describe('oauth', () => {
	it('названия провайдеров', () => {
		expect(providerTitle('yandex')).toBe('Яндекс');
		expect(providerTitle('vk')).toBe('Vk');
	});

	it('коды ошибок → текст, неизвестный код — общий текст', () => {
		expect(oauthErrorMessage('access_denied')).toBe('Вход отменён.');
		expect(oauthErrorMessage('provider_already_linked')).toMatch(/отвяжите/);
		expect(oauthErrorMessage('weird')).toMatch(/Не удалось/);
	});
});
