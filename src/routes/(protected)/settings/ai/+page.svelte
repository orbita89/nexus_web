<script lang="ts">
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import Alert from '#lib/components/Alert.svelte';
	import { PRESETS, presetById } from '#lib/tutor/presets.ts';
	import { listProviders, type UserAiProvider } from '#lib/tutor/api.ts';

	// Свои ключи ИИ для ИИ-преподавателя: платит за запросы сам пользователь. Ключ уходит на
	// сервер один раз и хранится зашифрованным — обратно не показывается (только sk-…1234).
	let providers = $state<UserAiProvider[]>([]);
	let loading = $state(true);
	let error = $state('');
	let notice = $state('');
	let busy = $state(false);
	let tests = $state<Record<string, { ok: boolean; message: string } | 'running'>>({});

	let preset = $state(PRESETS[0].id);
	let form = $state({ title: '', base_url: '', model: '', api_key: '' });

	function applyPreset(id: string) {
		const p = presetById(id);
		form.title = p.title;
		form.base_url = p.base_url;
		form.model = p.model;
	}

	async function load() {
		try {
			providers = await listProviders(api);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		applyPreset(preset);
		void load();
	});

	async function add(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = notice = '';
		try {
			const created = await unwrap(
				api.catalog.POST('/api/v1/catalog/me/ai-providers', {
					body: {
						kind: presetById(preset).kind,
						title: form.title,
						base_url: form.base_url || null,
						model: form.model,
						api_key: form.api_key
					}
				})
			);
			form.api_key = '';
			await load();
			notice = 'Ключ сохранён. Проверьте его кнопкой «Проверить».';
			void test(created.id);
		} catch (err) {
			error = errorMessage(err);
		} finally {
			busy = false;
		}
	}

	async function makeDefault(id: string) {
		try {
			await unwrap(
				api.catalog.PATCH('/api/v1/catalog/me/ai-providers/{id}', {
					params: { path: { id } },
					body: { is_default: true }
				})
			);
			await load();
		} catch (e) {
			error = errorMessage(e);
		}
	}

	async function remove(id: string) {
		try {
			await unwrap(
				api.catalog.DELETE('/api/v1/catalog/me/ai-providers/{id}', { params: { path: { id } } })
			);
			await load();
		} catch (e) {
			error = errorMessage(e);
		}
	}

	async function test(id: string) {
		tests[id] = 'running';
		try {
			tests[id] = await unwrap(
				api.catalog.POST('/api/v1/catalog/me/ai-providers/{id}/test', { params: { path: { id } } })
			);
		} catch (e) {
			tests[id] = { ok: false, message: errorMessage(e) };
		}
	}
</script>

<svelte:head><title>Ключи ИИ — Настройки — Кассандра</title></svelte:head>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-bold">Ключи ИИ</h1>
		<p class="mt-1 max-w-2xl text-sm text-base-content/60">
			ИИ-преподаватель обсуждает книги на вашем ключе: запросы оплачиваете вы у своего провайдера.
			Ключ хранится зашифрованным и обратно не показывается. Чтобы было дешевле, в модель уходит не
			вся переписка, а её краткое содержание и последние реплики.
		</p>
	</div>

	{#if error}<Alert>{error}</Alert>{/if}
	{#if notice}<Alert kind="success">{notice}</Alert>{/if}

	{#if loading}
		<div class="h-24 animate-pulse rounded-box bg-base-200"></div>
	{:else if providers.length}
		<ul class="flex flex-col gap-2">
			{#each providers as p (p.id)}
				{@const t = tests[p.id]}
				<li class="flex flex-wrap items-center gap-3 rounded-box bg-base-200 p-3">
					<div class="min-w-0 flex-1">
						<p class="font-semibold">
							{p.title}
							{#if p.is_default}<span class="badge badge-soft badge-sm badge-primary"
									>по умолчанию</span
								>{/if}
						</p>
						<p class="truncate text-xs text-base-content/60">
							{p.model} · {p.base_url ??
								(p.kind === 'anthropic' ? 'api.anthropic.com' : 'api.openai.com')}
							· {p.key_hint}
						</p>
						{#if t === 'running'}
							<p class="text-xs text-base-content/60">Проверяем…</p>
						{:else if t}
							<p class={['text-xs', t.ok ? 'text-success' : 'text-error']}>
								{t.ok ? `Работает: «${t.message}»` : `Ошибка: ${t.message}`}
							</p>
						{/if}
					</div>
					<button type="button" class="btn btn-sm" onclick={() => test(p.id)}>Проверить</button>
					{#if !p.is_default}
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => makeDefault(p.id)}
							>Сделать основным</button
						>
					{/if}
					<button type="button" class="btn btn-ghost btn-sm" onclick={() => remove(p.id)}
						>Удалить</button
					>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-base-content/60">Ключей пока нет.</p>
	{/if}

	<form class="flex max-w-xl flex-col gap-3 rounded-box bg-base-200 p-4" onsubmit={add}>
		<h2 class="font-semibold">Добавить ключ</h2>
		<label class="select w-full">
			<span class="label">Провайдер</span>
			<select bind:value={preset} onchange={() => applyPreset(preset)} aria-label="Провайдер">
				{#each PRESETS as p (p.id)}
					<option value={p.id}>{p.title}</option>
				{/each}
			</select>
		</label>
		<label class="floating-label">
			<span>Название</span>
			<input
				class="input w-full"
				placeholder="Название"
				maxlength="60"
				required
				bind:value={form.title}
			/>
		</label>
		<label class="floating-label">
			<span>Адрес API (пусто — по умолчанию)</span>
			<input
				class="input w-full"
				placeholder="https://api.example.com/v1"
				bind:value={form.base_url}
			/>
		</label>
		<label class="floating-label">
			<span>Модель</span>
			<input
				class="input w-full"
				placeholder="Модель"
				maxlength="120"
				required
				bind:value={form.model}
			/>
		</label>
		<label class="floating-label">
			<span>Ключ API</span>
			<input
				class="input w-full"
				type="password"
				autocomplete="off"
				placeholder="Ключ API"
				required
				bind:value={form.api_key}
			/>
		</label>
		<p class="text-xs text-base-content/60">{presetById(preset).hint}</p>
		<div><button class="btn btn-primary" disabled={busy}>Сохранить ключ</button></div>
	</form>
</div>
