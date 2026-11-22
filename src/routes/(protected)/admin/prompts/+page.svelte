<script lang="ts">
	import { onMount } from 'svelte';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import {
		DEFAULT_SCOPE,
		deleteAiPrompt,
		effective,
		listAiPrompts,
		previewAiPrompts,
		putAiPrompt,
		scopeTitle,
		unknownPlaceholders,
		type AiPromptPreview,
		type AiPrompts
	} from '#lib/catalog/ai-prompts.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Промпты ИИ: что уходит в модель. Встроенный текст живёт в коде бэкенда; здесь его можно
	// переопределить для всех сущностей или для одного типа. Поиск: тип → «Все сущности» →
	// встроенный. Подстановки {имя} бэкенд заполняет сам (книга, процент прочитанного и т.п.).
	const SOURCE_TITLES = {
		scope: 'своя правка',
		default: 'из «Все сущности»',
		builtin: 'встроенный'
	} as const;

	let data = $state<AiPrompts | null>(null);
	let scope = $state('book');
	let drafts = $state<Record<string, string>>({});
	let busy = $state('');
	let error = $state('');
	let notice = $state('');
	let preview = $state<AiPromptPreview | null>(null);
	let previewBusy = $state(false);

	function fillDrafts() {
		if (!data) return;
		drafts = Object.fromEntries(data.prompts.map((p) => [p.key, effective(p, scope).template]));
	}

	async function load() {
		try {
			data = await listAiPrompts(api);
			fillDrafts();
		} catch (e) {
			error = errorMessage(e);
		}
	}

	onMount(load);

	function pickScope(next: string) {
		scope = next;
		preview = null;
		notice = '';
		fillDrafts();
	}

	async function save(key: string) {
		busy = key;
		error = notice = '';
		try {
			await putAiPrompt(api, key, scope, drafts[key]);
			await load();
			notice = `Сохранено для «${scopeTitle(scope)}».`;
			preview = null;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = '';
		}
	}

	async function reset(key: string) {
		busy = key;
		error = notice = '';
		try {
			await deleteAiPrompt(api, key, scope);
			await load();
			notice = 'Правка убрана — действует общий или встроенный текст.';
			preview = null;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = '';
		}
	}

	async function showPreview() {
		previewBusy = true;
		error = '';
		try {
			preview = await previewAiPrompts(api, scope);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			previewBusy = false;
		}
	}
</script>

<svelte:head><title>Промпты ИИ — админка</title></svelte:head>

<h1 class="mb-2 text-2xl font-bold">Промпты ИИ</h1>
<p class="mb-4 max-w-3xl text-sm text-base-content/70">
	Тексты, которые уходят в модель ИИ-преподавателя. Правка для типа (например, «Книги») важнее
	правки для «Все сущности», та — важнее встроенной. Сейчас ИИ-преподаватель работает только с
	книгами; правки для других типов начнут действовать, когда ИИ появится и у них. Изменения
	применяются к следующему вопросу — пересборка не нужна.
</p>

{#if error}<div class="mb-3"><Alert>{error}</Alert></div>{/if}
{#if notice}<p role="status" class="mb-3 text-sm text-success">{notice}</p>{/if}

{#if !data}
	{#if !error}<div class="flex justify-center py-10">
			<span class="loading loading-spinner"></span>
		</div>{/if}
{:else}
	<div role="tablist" class="tabs tabs-box mb-4 flex-wrap tabs-sm">
		{#each data.scopes as s (s)}
			<button
				type="button"
				role="tab"
				class={['tab', s === scope && 'tab-active']}
				aria-selected={s === scope}
				onclick={() => pickScope(s)}
				>{scopeTitle(s)}
				{#if data.prompts.some((p) => p.overrides.some((o) => o.scope === s))}
					<span class="ml-1 badge badge-xs badge-primary" title="Есть правки">•</span>
				{/if}
			</button>
		{/each}
	</div>

	<div class="flex flex-col gap-4">
		{#each data.prompts as p (p.key)}
			{@const current = effective(p, scope)}
			{@const own = p.overrides.find((o) => o.scope === scope)}
			{@const draft = drafts[p.key] ?? ''}
			{@const unknown = unknownPlaceholders(p, draft)}
			{@const changed = draft !== current.template}
			<section class="card bg-base-200 ring-1 ring-base-300">
				<div class="card-body gap-3 p-4">
					<div class="flex flex-wrap items-center gap-2">
						<h2 class="text-lg font-semibold">{p.title}</h2>
						<code class="text-xs text-base-content/50">{p.key}</code>
						<span
							class={[
								'badge badge-sm',
								current.source === 'builtin' ? 'badge-ghost' : 'badge-soft badge-primary'
							]}>{SOURCE_TITLES[current.source]}</span
						>
						{#if own}
							<span class="text-xs text-base-content/50"
								>изменён {new Date(own.updated_at).toLocaleString('ru')}</span
							>
						{/if}
					</div>
					<p class="text-sm text-base-content/70">{p.description}</p>
					{#if p.placeholders.length}
						<ul class="flex flex-wrap gap-2 text-xs">
							{#each p.placeholders as ph (ph.name)}
								<li class="rounded-box bg-base-100 px-2 py-1">
									<code class="font-semibold">{`{${ph.name}}`}</code> — {ph.description}
								</li>
							{/each}
						</ul>
					{/if}
					<textarea
						class="textarea min-h-28 w-full font-mono text-sm"
						rows={Math.min(12, Math.max(3, draft.split('\n').length + 2))}
						maxlength="6000"
						aria-label={`${p.title} — ${scopeTitle(scope)}`}
						bind:value={drafts[p.key]}></textarea>
					{#if unknown.length}
						<p class="text-sm text-warning">
							Неизвестные подстановки: {unknown.map((u) => `{${u}}`).join(', ')} — бэкенд не примет.
						</p>
					{/if}
					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							class="btn btn-primary btn-sm"
							disabled={!changed || !draft.trim() || unknown.length > 0 || busy !== ''}
							onclick={() => save(p.key)}
						>
							{#if busy === p.key}<span class="loading loading-xs loading-spinner"></span>{/if}
							Сохранить для «{scopeTitle(scope)}»
						</button>
						{#if changed}
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={() => (drafts[p.key] = current.template)}>Отменить</button
							>
						{/if}
						{#if own}
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								disabled={busy !== ''}
								onclick={() => reset(p.key)}
								>{scope === DEFAULT_SCOPE ? 'Вернуть встроенный' : 'Убрать правку'}</button
							>
						{/if}
						{#if draft !== p.builtin}
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={() => (drafts[p.key] = p.builtin)}>Подставить встроенный</button
							>
						{/if}
						<span class="ml-auto text-xs text-base-content/50">{draft.length} симв.</span>
					</div>
				</div>
			</section>
		{/each}
	</div>

	<section class="mt-6">
		<div class="mb-2 flex flex-wrap items-center gap-2">
			<h2 class="text-lg font-semibold">Как это увидит модель</h2>
			<button type="button" class="btn btn-sm" disabled={previewBusy} onclick={showPreview}>
				{#if previewBusy}<span class="loading loading-xs loading-spinner"></span>{/if}
				Собрать пример для «{scopeTitle(scope)}»
			</button>
		</div>
		<p class="mb-2 text-sm text-base-content/60">
			На примере «Мастера и Маргариты»: читатель на 30%, есть резюме ранних реплик. Учитываются
			только сохранённые правки.
		</p>
		{#if preview}
			<div class="grid gap-3">
				{#each [{ t: 'Системный промпт', v: preview.system }, { t: 'Вопрос по фрагменту', v: preview.quote_question }, { t: 'Запрос на сжатие', v: preview.summarize }] as block (block.t)}
					<div>
						<h3 class="mb-1 text-sm font-semibold">{block.t}</h3>
						<pre
							class="rounded-box bg-base-200 p-3 text-sm whitespace-pre-wrap ring-1 ring-base-300">{block.v}</pre>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="mt-6">
		<h2 class="mb-2 text-lg font-semibold">Пределы</h2>
		<p class="mb-2 text-sm text-base-content/60">
			Задают цену запроса; меняются в коде бэкенда (<code>tutor/prompt.rs</code>).
		</p>
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<tbody>
					{#each data.limits as l (l.name)}
						<tr>
							<td><code>{l.name}</code></td>
							<td class="text-right font-mono">{l.value.toLocaleString('ru')}</td>
							<td class="text-base-content/70">{l.description}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}
