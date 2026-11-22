import { describe, expect, it } from 'vitest';
import { effective, unknownPlaceholders, type AiPrompt } from './ai-prompts.ts';

const at = '2026-11-22T10:00:00Z';
const prompt = (overrides: AiPrompt['overrides'] = []): AiPrompt => ({
	key: 'tutor.system',
	title: 'Системный промпт',
	description: '',
	placeholders: [{ name: 'about', description: 'книга' }],
	builtin: 'встроенный {about}',
	overrides
});

describe('effective', () => {
	it('own scope → default → builtin', () => {
		const p = prompt([
			{ scope: 'default', template: 'общий', updated_at: at },
			{ scope: 'book', template: 'книжный', updated_at: at }
		]);
		expect(effective(p, 'book')).toEqual({ template: 'книжный', source: 'scope' });
		expect(effective(p, 'movie')).toEqual({ template: 'общий', source: 'default' });
		expect(effective(p, 'default').source).toBe('default');
		expect(effective(prompt(), 'book')).toEqual({
			template: 'встроенный {about}',
			source: 'builtin'
		});
	});
});

describe('unknownPlaceholders', () => {
	it('finds typos once, ignores known and non-names', () => {
		expect(unknownPlaceholders(prompt(), '{about} {abuot} {abuot} {Не имя}')).toEqual(['abuot']);
	});
});
