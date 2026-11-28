<script lang="ts">
	import { page } from '$app/state';
	import { errorMessage } from '#lib/api/errors.ts';
	import { api } from '#lib/auth/session.svelte.ts';
	import LoadError from '#lib/components/catalog/LoadError.svelte';
	import Seo from '#lib/components/catalog/Seo.svelte';
	import TutorChat from '#lib/components/tutor/TutorChat.svelte';
	import { getThread, threadTarget } from '#lib/tutor/api.ts';

	// Обсуждение с ИИ из профиля: та же беседа, можно продолжить.
	const id = $derived(page.params.id ?? '');
	let book = $state<ReturnType<typeof threadTarget>>(null);
	let error = $state('');

	$effect(() => {
		const current = id;
		book = null;
		error = '';
		getThread(api, current)
			.then((t) => {
				if (current !== id) return;
				book = threadTarget(t);
				if (!book) error = 'Обсуждение недоступно';
			})
			.catch((e) => (error = errorMessage(e)));
	});
</script>

<Seo title="Обсуждение с ИИ" noindex />

{#if error}
	<LoadError message={error} />
{:else if book}
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<h1 class="text-2xl font-bold">
			{book.target === 'person' ? 'Обсуждение с ИИ' : 'ИИ-преподаватель'}
		</h1>
		<a href={book.href} class="link text-sm link-primary"
			>{book.target === 'person' ? book.title : `«${book.title}»`}</a
		>
	</div>
	<div class="h-[70vh] overflow-hidden rounded-box bg-base-100 ring-1 ring-base-300">
		{#key id}<TutorChat slug={book.slug} target={book.target} threadId={id} />{/key}
	</div>
{:else}
	<div class="h-[70vh] animate-pulse rounded-box bg-base-200" aria-hidden="true"></div>
{/if}
