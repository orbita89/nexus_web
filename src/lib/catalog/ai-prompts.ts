// Промпты ИИ (админка): встроенные тексты, переопределения для всех сущностей (`default`) или
// для одного типа (`book`, `movie`, …) и пример собранного промпта. Все вызовы — с токеном admin.

import { unwrap } from '#lib/api/errors.ts';
import type { Api } from '#lib/api/client.ts';
import type {
	SchemaAiPrompt,
	SchemaAiPromptOverride,
	SchemaAiPromptPreview,
	SchemaAiPrompts
} from '#lib/api/generated/catalog.ts';

export type AiPrompt = SchemaAiPrompt;
export type AiPromptOverride = SchemaAiPromptOverride;
export type AiPromptPreview = SchemaAiPromptPreview;
export type AiPrompts = SchemaAiPrompts;

export const DEFAULT_SCOPE = 'default';

const SCOPE_TITLES: Record<string, string> = {
	default: 'Все сущности',
	book: 'Книги',
	movie: 'Фильмы',
	series: 'Сериалы',
	season: 'Сезоны',
	game: 'Игры',
	painting: 'Картины'
};

export const scopeTitle = (scope: string) => SCOPE_TITLES[scope] ?? scope;

/** Действующий текст для области: своя правка → общая (`default`) → встроенный. */
export function effective(
	prompt: AiPrompt,
	scope: string
): { template: string; source: 'scope' | 'default' | 'builtin' } {
	const own = prompt.overrides.find((o) => o.scope === scope);
	if (own) return { template: own.template, source: scope === DEFAULT_SCOPE ? 'default' : 'scope' };
	const common = prompt.overrides.find((o) => o.scope === DEFAULT_SCOPE);
	if (common) return { template: common.template, source: 'default' };
	return { template: prompt.builtin, source: 'builtin' };
}

/** Подстановки `{имя}` в тексте, которых нет у промпта (опечатки) — как проверяет бэкенд. */
export function unknownPlaceholders(prompt: AiPrompt, template: string): string[] {
	const known = new Set(prompt.placeholders.map((p) => p.name));
	const found = [...template.matchAll(/\{([a-z_]{1,30})\}/g)].map((m) => m[1]);
	return [...new Set(found.filter((name) => !known.has(name)))];
}

export function listAiPrompts(api: Api): Promise<AiPrompts> {
	return unwrap(api.catalog.GET('/api/v1/catalog/admin/ai/prompts'));
}

export function putAiPrompt(
	api: Api,
	key: string,
	scope: string,
	template: string
): Promise<AiPromptOverride> {
	return unwrap(
		api.catalog.PUT('/api/v1/catalog/admin/ai/prompts/{key}/{scope}', {
			params: { path: { key, scope } },
			body: { template }
		})
	);
}

export async function deleteAiPrompt(api: Api, key: string, scope: string): Promise<void> {
	await unwrap(
		api.catalog.DELETE('/api/v1/catalog/admin/ai/prompts/{key}/{scope}', {
			params: { path: { key, scope } }
		})
	);
}

export function previewAiPrompts(api: Api, scope: string): Promise<AiPromptPreview> {
	return unwrap(
		api.catalog.GET('/api/v1/catalog/admin/ai/prompts/preview', {
			params: { query: { scope } }
		})
	);
}
