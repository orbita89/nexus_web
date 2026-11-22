// Готовые настройки популярных провайдеров для формы «Добавить ключ»: адрес и недорогая модель.
// Любой другой OpenAI-совместимый сервис — «Другой (OpenAI-совместимый)».

export interface AiPreset {
	id: string;
	title: string;
	kind: 'openai' | 'anthropic';
	base_url: string;
	model: string;
	hint: string;
}

export const PRESETS: readonly AiPreset[] = [
	{
		id: 'deepseek',
		title: 'DeepSeek',
		kind: 'openai',
		base_url: 'https://api.deepseek.com',
		model: 'deepseek-chat',
		hint: 'Один из самых дешёвых вариантов; ключ — platform.deepseek.com.'
	},
	{
		id: 'openai',
		title: 'OpenAI',
		kind: 'openai',
		base_url: '',
		model: 'gpt-4o-mini',
		hint: 'Ключ — platform.openai.com.'
	},
	{
		id: 'anthropic',
		title: 'Anthropic (Claude)',
		kind: 'anthropic',
		base_url: '',
		model: 'claude-haiku-5-5',
		hint: 'Ключ — console.anthropic.com. Haiku — быстрая и недорогая модель.'
	},
	{
		id: 'openrouter',
		title: 'OpenRouter',
		kind: 'openai',
		base_url: 'https://openrouter.ai/api/v1',
		model: 'deepseek/deepseek-chat',
		hint: 'Много моделей по одному ключу; ключ — openrouter.ai.'
	},
	{
		id: 'custom',
		title: 'Другой (OpenAI-совместимый)',
		kind: 'openai',
		base_url: '',
		model: '',
		hint: 'Любой сервис с API /chat/completions: укажите адрес и модель.'
	}
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];
