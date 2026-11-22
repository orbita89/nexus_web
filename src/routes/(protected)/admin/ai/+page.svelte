<script lang="ts">
	import { errorMessage } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import {
		AI_EFFORTS,
		AI_KINDS,
		AI_PRESETS,
		createAiProvider,
		deleteAiProvider,
		listAiProviders,
		parseKeys,
		testAiProvider,
		updateAiProvider,
		type AiEffort,
		type AiKind,
		type AiProvider,
		type AiProviderInput,
		type AiTest
	} from '#lib/catalog/ai.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Провайдеры ИИ (то же, что `make ai`): адрес, модель, ключи, лимиты. Скрипты
	// (`make books-llm`) берут провайдера по умолчанию отсюда. Ключи только записываются:
	// при правке поле ключей пустое — пустое значит «оставить как есть».
	const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
	const KIND_TITLES: Record<AiKind, string> = {
		openai: 'OpenAI-совместимый (OpenAI, DeepSeek, OpenRouter, Qwen, Gemini, Ollama)',
		anthropic: 'Anthropic (Claude)'
	};

	interface Draft {
		slug: string;
		kind: AiKind;
		base_url: string;
		model: string;
		keys: string;
		workers: number;
		per_request: number;
		effort: AiEffort;
		is_default: boolean;
	}
	const emptyDraft = (): Draft => ({
		slug: '',
		kind: 'openai',
		base_url: '',
		model: '',
		keys: '',
		workers: 8,
		per_request: 100,
		effort: 'low',
		is_default: false
	});

	let providers = $state<AiProvider[]>([]);
	let loaded = $state(false);
	let error = $state('');
	let notice = $state('');
	/** null — форма закрыта, '' — новый провайдер, иначе slug редактируемого. */
	let editing = $state<string | null>(null);
	let draft = $state<Draft>(emptyDraft());
	let busy = $state(false);
	let confirmDelete = $state<string | null>(null);
	let testing = $state<string | null>(null);
	let tests = $state<Record<string, AiTest>>({});

	async function load() {
		try {
			providers = await listAiProviders(api);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loaded = true;
		}
	}
	void load();

	function openNew() {
		draft = emptyDraft();
		editing = '';
		error = notice = '';
	}

	function openEdit(p: AiProvider) {
		draft = {
			slug: p.slug,
			kind: p.kind as AiKind,
			base_url: p.base_url ?? '',
			model: p.model,
			keys: '',
			workers: p.workers,
			per_request: p.per_request,
			effort: p.effort as AiEffort,
			is_default: p.is_default
		};
		editing = p.slug;
		error = notice = '';
	}

	function preset(i: number) {
		const p = AI_PRESETS[i];
		draft.kind = p.kind;
		draft.base_url = p.base_url;
		draft.model = p.model || draft.model;
		if (!draft.slug && editing === '') draft.slug = p.label.toLowerCase();
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const isNew = editing === '';
		const keys = parseKeys(draft.keys);
		error =
			(isNew && !SLUG_RE.test(draft.slug) && 'Имя: латиница, цифры и «-», до 40 знаков.') ||
			(!draft.model.trim() && 'Укажите модель.') ||
			(isNew && keys.length === 0 && 'Укажите хотя бы один ключ.') ||
			'';
		if (error) return;
		const body: AiProviderInput = {
			kind: draft.kind,
			base_url: draft.base_url.trim(),
			model: draft.model.trim(),
			workers: draft.workers,
			per_request: draft.per_request,
			effort: draft.effort,
			...(keys.length > 0 && { api_keys: keys }),
			...((isNew || draft.is_default) && { is_default: draft.is_default || undefined })
		};
		busy = true;
		try {
			if (isNew) await createAiProvider(api, { ...body, slug: draft.slug });
			else await updateAiProvider(api, editing!, body);
			notice = isNew ? `Провайдер «${draft.slug}» сохранён.` : 'Изменения сохранены.';
			editing = null;
			await load();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function makeDefault(slug: string) {
		error = notice = '';
		try {
			await updateAiProvider(api, slug, { is_default: true });
			await load();
		} catch (e) {
			error = errorMessage(e);
		}
	}

	async function remove(slug: string) {
		error = notice = '';
		try {
			await deleteAiProvider(api, slug);
			confirmDelete = null;
			if (editing === slug) editing = null;
			await load();
		} catch (e) {
			error = errorMessage(e);
		}
	}

	async function test(slug: string) {
		error = notice = '';
		testing = slug;
		try {
			tests[slug] = await testAiProvider(api, slug);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			testing = null;
		}
	}
</script>

<svelte:head><title>Провайдеры ИИ — админка</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
	<h1 class="text-2xl font-bold">Провайдеры ИИ</h1>
	{#if editing === null}
		<button type="button" class="btn btn-primary btn-sm" onclick={openNew}>Добавить</button>
	{/if}
</div>

<p class="mb-4 text-sm text-base-content/70">
	Ключи и модели для служебных задач. Скрипт чистки книг <code>make books-llm</code> берёт
	провайдера по умолчанию (★); другой — <code>make books-llm AI=имя</code>. Ключи хранятся
	зашифрованными и после сохранения не показываются.
</p>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}
{#if notice}<div class="mb-4"><Alert kind="success">{notice}</Alert></div>{/if}

{#if editing !== null}
	<form
		class="mb-6 grid gap-4 rounded-box bg-base-200 p-4 ring-1 ring-base-300"
		onsubmit={save}
		novalidate
	>
		<h2 class="text-lg font-semibold">
			{editing === '' ? 'Новый провайдер' : `Провайдер «${editing}»`}
		</h2>

		{#if editing === ''}
			<div class="flex flex-wrap gap-2">
				<span class="self-center text-sm text-base-content/70">Шаблон:</span>
				{#each AI_PRESETS as p, i (p.label)}
					<button type="button" class="btn btn-outline btn-xs" onclick={() => preset(i)}
						>{p.label}</button
					>
				{/each}
			</div>
			<label class="form-control">
				<span class="label-text mb-1">Имя (slug)</span>
				<input
					class="input w-full max-w-xs input-sm"
					bind:value={draft.slug}
					placeholder="deepseek"
					autocomplete="off"
				/>
			</label>
		{/if}

		<label class="form-control">
			<span class="label-text mb-1">Протокол</span>
			<select class="select w-full max-w-md select-sm" bind:value={draft.kind}>
				{#each AI_KINDS as k (k)}<option value={k}>{KIND_TITLES[k]}</option>{/each}
			</select>
		</label>

		<label class="form-control">
			<span class="label-text mb-1">URL API (пусто — адрес провайдера по умолчанию)</span>
			<input
				class="input w-full input-sm"
				type="url"
				bind:value={draft.base_url}
				placeholder="https://api.deepseek.com"
				autocomplete="off"
			/>
		</label>

		<label class="form-control">
			<span class="label-text mb-1">Модель</span>
			<input
				class="input w-full max-w-md input-sm"
				bind:value={draft.model}
				placeholder="deepseek-chat"
				autocomplete="off"
			/>
		</label>

		<label class="form-control">
			<span class="label-text mb-1">
				API-ключи — по одному в строке; несколько ключей используются по очереди
				{#if editing !== ''}<br /><span class="text-base-content/60"
						>пусто — оставить прежние; заполнено — заменить все</span
					>{/if}
			</span>
			<textarea
				class="textarea w-full font-mono textarea-sm"
				rows="3"
				bind:value={draft.keys}
				placeholder="sk-..."
				autocomplete="off"
				spellcheck="false"></textarea>
		</label>

		<div class="flex flex-wrap gap-4">
			<label class="form-control">
				<span class="label-text mb-1">Запросов одновременно (1–64)</span>
				<input
					class="input w-32 input-sm"
					type="number"
					min="1"
					max="64"
					bind:value={draft.workers}
				/>
			</label>
			<label class="form-control">
				<span class="label-text mb-1">Книг в запросе (1–500)</span>
				<input
					class="input w-32 input-sm"
					type="number"
					min="1"
					max="500"
					bind:value={draft.per_request}
				/>
			</label>
		</div>
		<p class="-mt-2 text-xs text-base-content/60">
			Ошибка 429 от провайдера — уменьшите «одновременно»; слабой модели лучше 30–50 книг в запросе.
		</p>

		<label class="form-control">
			<span class="label-text mb-1">Effort (усилие рассуждения)</span>
			<select class="select w-48 select-sm" bind:value={draft.effort}>
				{#each AI_EFFORTS as e (e.value)}<option value={e.value}>{e.title}</option>{/each}
			</select>
			<span class="mt-1 text-xs text-base-content/60"
				>low — дёшево и быстро, для разметки книг хватает. Модель без рассуждений параметр просто не
				получит.</span
			>
		</label>

		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={draft.is_default} />
			Провайдер по умолчанию
		</label>

		<div class="flex gap-2">
			<button class="btn btn-primary btn-sm" disabled={busy}>
				{busy ? 'Сохраняю…' : 'Сохранить'}
			</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (editing = null)}
				>Отмена</button
			>
		</div>
	</form>
{/if}

{#if loaded && providers.length === 0 && editing === null}
	<Alert kind="info">Провайдеров пока нет — нажмите «Добавить».</Alert>
{:else if providers.length > 0}
	<div class="overflow-x-auto">
		<table class="table table-sm">
			<thead>
				<tr>
					<th>Имя</th>
					<th>Протокол / URL</th>
					<th>Модель</th>
					<th>Ключи</th>
					<th>Лимиты</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each providers as p (p.slug)}
					<tr>
						<td class="font-medium whitespace-nowrap">
							{#if p.is_default}<span title="По умолчанию" class="text-warning">★</span>{/if}
							{p.slug}
						</td>
						<td>
							<div>{p.kind}</div>
							<div class="text-xs break-all text-base-content/60">
								{p.base_url ?? 'по умолчанию'}
							</div>
						</td>
						<td class="break-all">{p.model}</td>
						<td class="font-mono text-xs whitespace-nowrap">
							{p.keys_hint}{#if p.keys_count > 1}&nbsp;+{p.keys_count - 1}{/if}
						</td>
						<td class="text-xs whitespace-nowrap"
							>{p.workers} × {p.per_request}, effort {p.effort}</td
						>
						<td>
							<div class="flex flex-wrap justify-end gap-1">
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									disabled={testing !== null}
									onclick={() => test(p.slug)}
									>{testing === p.slug ? 'Проверяю…' : 'Проверить'}</button
								>
								<button type="button" class="btn btn-ghost btn-xs" onclick={() => openEdit(p)}
									>Изменить</button
								>
								{#if !p.is_default}
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										onclick={() => makeDefault(p.slug)}>★ по умолчанию</button
									>
								{/if}
								{#if confirmDelete === p.slug}
									<button type="button" class="btn btn-error btn-xs" onclick={() => remove(p.slug)}
										>Удалить?</button
									>
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										onclick={() => (confirmDelete = null)}>Нет</button
									>
								{:else}
									<button
										type="button"
										class="btn btn-ghost text-error btn-xs"
										onclick={() => (confirmDelete = p.slug)}>Удалить</button
									>
								{/if}
							</div>
						</td>
					</tr>
					{#if tests[p.slug]}
						{@const t = tests[p.slug]}
						<tr>
							<td colspan="6">
								<Alert kind={t.ok ? 'success' : 'warning'}>
									<div>
										{#each t.errors as e, i (i)}
											<div>Ключ {i + 1}: {e ?? 'работает'}</div>
										{/each}
										{#if t.reply}<div class="mt-1 text-xs">Ответ модели: {t.reply}</div>{/if}
									</div>
								</Alert>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/if}
