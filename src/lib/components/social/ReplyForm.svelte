<script lang="ts">
	import { onMount } from 'svelte';
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaPost } from '#lib/api/generated/social.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import { LIMITS } from '#lib/social/forum.ts';
	import Alert from '#lib/components/Alert.svelte';

	// Ответ в тему (parentId не задан) или на сообщение. Только для вошедших — проверяет страница.
	let {
		threadId,
		parentId = null,
		autofocus = false,
		onposted,
		oncancel
	}: {
		threadId: string;
		parentId?: string | null;
		autofocus?: boolean;
		onposted: (post: SchemaPost) => void;
		oncancel?: () => void;
	} = $props();

	let body = $state('');
	let field: HTMLTextAreaElement;
	// Форма открылась по кнопке «Ответить» — сразу в поле ввода.
	onMount(() => {
		if (autofocus) field.focus();
	});
	let busy = $state(false);
	let error = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = body.trim();
		if (!text) return;
		busy = true;
		error = '';
		try {
			const post = await unwrap(
				api.social.POST('/api/v1/social/threads/{id}/posts', {
					params: { path: { id: threadId } },
					body: { body: text, parent_id: parentId }
				})
			);
			body = '';
			onposted(post);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<form class="flex flex-col gap-2" onsubmit={submit}>
	<label class="sr-only" for="reply-{parentId ?? 'thread'}"
		>{parentId ? 'Ваш ответ на сообщение' : 'Ваш ответ в теме'}</label
	>
	<textarea
		bind:this={field}
		id="reply-{parentId ?? 'thread'}"
		class="textarea min-h-24 w-full"
		maxlength={LIMITS.postBody}
		placeholder={parentId ? 'Ответ на сообщение' : 'Ваш ответ'}
		bind:value={body}></textarea>
	{#if error}<Alert>{error}</Alert>{/if}
	<div class="flex gap-2">
		<button class="btn btn-primary btn-sm" disabled={busy || !body.trim()}>Отправить</button>
		{#if oncancel}<button type="button" class="btn btn-ghost btn-sm" onclick={oncancel}
				>Отмена</button
			>{/if}
	</div>
</form>
