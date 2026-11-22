// Провайдеры ИИ для служебных задач (разметка книг `make books-llm` и т.п.): адрес, модель, ключи.
// Ключи только записываются — бэкенд хранит их зашифрованными и отдаёт подсказку `sk-…a1b2`.
// Все вызовы — с токеном admin.

import { unwrap } from '#lib/api/errors.ts';
import type { Api } from '#lib/api/client.ts';
import type {
	SchemaAiEffort,
	SchemaAiKind,
	SchemaAiProvider,
	SchemaAiProviderInput,
	SchemaAiTest,
	SchemaCreateAiProvider
} from '#lib/api/generated/catalog.ts';

export type AiKind = SchemaAiKind;
export type AiEffort = SchemaAiEffort;
export type AiProvider = SchemaAiProvider;
export type AiProviderInput = SchemaAiProviderInput;
export type CreateAiProvider = SchemaCreateAiProvider;
export type AiTest = SchemaAiTest;

export const AI_EFFORTS = [
	{ value: 'none', title: 'none — без размышлений, дешевле всего' },
	{ value: 'low', title: 'low — по умолчанию' },
	{ value: 'medium', title: 'medium' },
	{ value: 'high', title: 'high' }
] as const satisfies readonly { value: AiEffort; title: string }[];

export const AI_KINDS = ['openai', 'anthropic'] as const satisfies readonly AiKind[];

/** Готовые адреса и модели — подставляются в форму, их можно поменять. */
export const AI_PRESETS = [
	{
		label: 'DeepSeek',
		kind: 'openai',
		base_url: 'https://api.deepseek.com',
		model: 'deepseek-chat'
	},
	{ label: 'OpenAI', kind: 'openai', base_url: '', model: 'gpt-4o-mini' },
	{ label: 'OpenRouter', kind: 'openai', base_url: 'https://openrouter.ai/api/v1', model: '' },
	{ label: 'Anthropic', kind: 'anthropic', base_url: '', model: 'claude-haiku-5-5' },
	{ label: 'Ollama', kind: 'openai', base_url: 'http://localhost:11434/v1', model: 'qwen2.5:14b' }
] as const satisfies readonly { label: string; kind: AiKind; base_url: string; model: string }[];

/** Ключи из textarea: по строке или через запятую, пустые отброшены. */
export const parseKeys = (text: string): string[] =>
	text
		.split(/[\n,]/)
		.map((k) => k.trim())
		.filter(Boolean);

export function listAiProviders(api: Api): Promise<AiProvider[]> {
	return unwrap(api.catalog.GET('/api/v1/catalog/admin/ai/providers'));
}

export function createAiProvider(api: Api, body: CreateAiProvider): Promise<AiProvider> {
	return unwrap(api.catalog.POST('/api/v1/catalog/admin/ai/providers', { body }));
}

/** Переданные поля меняются; `api_keys` заменяют все ключи; `base_url: ''` — адрес по умолчанию. */
export function updateAiProvider(
	api: Api,
	slug: string,
	body: AiProviderInput
): Promise<AiProvider> {
	return unwrap(
		api.catalog.PATCH('/api/v1/catalog/admin/ai/providers/{slug}', {
			params: { path: { slug } },
			body
		})
	);
}

export async function deleteAiProvider(api: Api, slug: string): Promise<void> {
	await unwrap(
		api.catalog.DELETE('/api/v1/catalog/admin/ai/providers/{slug}', {
			params: { path: { slug } }
		})
	);
}

/** Пробный запрос «ответь OK» на каждый ключ. */
export function testAiProvider(api: Api, slug: string): Promise<AiTest> {
	return unwrap(
		api.catalog.POST('/api/v1/catalog/admin/ai/providers/{slug}/test', {
			params: { path: { slug } }
		})
	);
}
