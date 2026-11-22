import { describe, expect, it } from 'vitest';
import { parseKeys } from './ai.ts';

describe('parseKeys', () => {
	it('splits by lines and commas, drops blanks', () => {
		expect(parseKeys(' sk-a \n\nsk-b, sk-c ,')).toEqual(['sk-a', 'sk-b', 'sk-c']);
		expect(parseKeys('   ')).toEqual([]);
	});
});
