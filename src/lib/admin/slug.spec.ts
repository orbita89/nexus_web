import { describe, expect, it } from 'vitest';
import { slugError, slugify } from './slug';

describe('slugify', () => {
	it('транслитерация и год', () => {
		expect(slugify('Dune', '2021')).toBe('dune-2021');
		expect(slugify('Дюна: Часть вторая', '2024')).toBe('dyuna-chast-vtoraya-2024');
		expect(slugify('Ведьмак 3: Дикая Охота')).toBe('vedmak-3-dikaya-okhota');
		expect(slugify('Щит и меч')).toBe('shchit-i-mech');
	});

	it('латиница, диакритика, мусор по краям', () => {
		expect(slugify('  Blade Runner 2049! ')).toBe('blade-runner-2049');
		expect(slugify('Pokémon')).toBe('pokemon');
		expect(slugify('S.T.A.L.K.E.R. 2')).toBe('s-t-a-l-k-e-r-2');
	});

	it('не длиннее 100 символов, без дефиса в конце', () => {
		const s = slugify('слово '.repeat(40));
		expect(s.length).toBeLessThanOrEqual(100);
		expect(s.endsWith('-')).toBe(false);
	});
});

describe('slugError', () => {
	it('правило бэкенда', () => {
		expect(slugError('dune-2021')).toBeNull();
		expect(slugError('')).toMatch(/Введите/);
		expect(slugError('Dune')).toMatch(/латиница/);
		expect(slugError('dune--2021')).toMatch(/латиница/);
		expect(slugError('-dune')).toMatch(/латиница/);
		expect(slugError('x'.repeat(101))).toMatch(/100/);
	});
});
