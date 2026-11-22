import { describe, expect, it } from 'vitest';
import { cleanValues, emptyValues, previewArgs, type Script } from './scripts.ts';

const script = {
	id: 'books-llm',
	group: 'Книги',
	title: 't',
	description: 'd',
	command: 'c',
	has_report: true,
	after: null,
	flags: [
		{ name: 'limit', type: 'int', min: 1, max: 10, default: '5', description: '' },
		{ name: 'yes', type: 'bool', description: '' },
		{ name: 'ai', type: 'text', pattern: '.*', description: '' }
	]
} as Script;

describe('script flags', () => {
	it('drops empty values and converts numbers', () => {
		expect(emptyValues(script)).toEqual({ limit: '', yes: false, ai: '' });
		expect(cleanValues(script, { limit: '7', yes: false, ai: '' })).toEqual({ limit: 7 });
		expect(previewArgs(script, { limit: '7', yes: true, ai: 'ds' })).toBe(
			'--limit 7 --yes --ai ds'
		);
	});
});
