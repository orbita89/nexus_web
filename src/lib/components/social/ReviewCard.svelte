<script lang="ts">
	import type { SchemaReview } from '#lib/api/generated/social.ts';
	import { refHref } from '#lib/catalog/kinds.ts';
	import { displayName, isEdited, isSpoiler, reviewDate } from '#lib/social/reviews.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import Clamp from '#lib/components/catalog/Clamp.svelte';
	import RatingBadge from './RatingBadge.svelte';
	import ReviewActions from './ReviewActions.svelte';
	import ModerateButton from './ModerateButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import { unwrap } from '#lib/api/errors.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';

	// Рецензия: автор (или произведение — в профиле), оценка, текст. Длинный текст свёрнут до 6
	// строк с «Читать полностью». Рецензия со спойлерами — текст размыт, поверх кнопка «Спойлер.
	// Нажмите, чтобы открыть»; пока размыт, его нет ни для мыши, ни для скринридера, ни для Tab.
	// Под текстом — 👍 / 👎 и комментарии (ReviewActions).
	let {
		review,
		showEntity = false,
		showAuthor = !showEntity,
		flat = false,
		lines = 6,
		onremoved = invalidateAll
	}: {
		review: SchemaReview;
		/** О каком произведении рецензия (профиль, лента). */
		showEntity?: boolean;
		/** Автор (на карточке и в ленте — да, в профиле — и так известен). */
		showAuthor?: boolean;
		/** Без своей карточки — строкой в общей плашке (лента на карточке произведения). */
		flat?: boolean;
		/** До скольких строк свёрнут текст. */
		lines?: 3 | 6;
		/** После удаления модератором: перечитать список (по умолчанию — load страницы). */
		onremoved?: () => unknown;
	} = $props();

	let revealed = $state(false);
	const hidden = $derived(isSpoiler(review) && !revealed);
	const entityLink = $derived(refHref(review.entity));
	// Админ удаляет чужие рецензии (свою — через «Ваша оценка»).
	const moderate = $derived(session.user?.role === 'admin' && session.user.id !== review.author.id);
</script>

<article class={flat ? 'py-4' : 'rounded-box bg-base-200 p-4 ring-1 ring-base-300'}>
	{#if !showAuthor}
		<!-- В профиле автор и так известен: рецензия начинается с произведения. -->
		<header class="flex items-start gap-3">
			<div class="min-w-0 flex-1">
				{#if entityLink}
					<a href={entityLink} class="block truncate font-semibold hover:text-primary"
						>{review.entity.title}</a
					>
				{:else}
					<span class="block truncate font-semibold">{review.entity.title}</span>
				{/if}
				<p class="text-xs text-base-content/50">
					<time datetime={review.created_at}>{reviewDate(review.created_at)}</time>
					{#if isEdited(review)}· изменено{/if}
				</p>
			</div>
			{#if review.rating != null}<RatingBadge value={review.rating} />{/if}
		</header>
	{:else}
		<header class="flex items-center gap-3">
			<a href="/u/{review.author.username}" class="shrink-0" tabindex="-1" aria-hidden="true">
				<Avatar user={review.author} size="w-9" />
			</a>
			<div class="min-w-0 flex-1">
				<a
					href="/u/{review.author.username}"
					class="block truncate font-semibold hover:text-primary">{displayName(review.author)}</a
				>
				<p class="text-xs text-base-content/50">
					<time datetime={review.created_at}>{reviewDate(review.created_at)}</time>
					{#if isEdited(review)}· изменено{/if}
				</p>
			</div>
			{#if isSpoiler(review)}
				<span class="badge badge-outline badge-sm badge-warning">спойлер</span>
			{/if}
			{#if review.rating != null}<RatingBadge value={review.rating} />{/if}
		</header>
		{#if showEntity && entityLink}
			<p class="mt-3 text-sm">
				<a href={entityLink} class="link font-semibold text-primary link-hover"
					>{review.entity.title}</a
				>
			</p>
		{/if}
	{/if}

	{#if review.body}
		<div class="relative mt-3">
			<!-- inert и aria-hidden: размытый текст не читается и не фокусируется, пока не открыли. -->
			<div
				class={[
					'transition-[filter] duration-300',
					{ 'pointer-events-none blur-md select-none': hidden }
				]}
				inert={hidden}
				aria-hidden={hidden || undefined}
				data-testid="review-body"
			>
				<Clamp {lines} more="Читать полностью" class="leading-relaxed text-base-content/85">
					<p class="whitespace-pre-line">{review.body}</p>
				</Clamp>
			</div>
			{#if hidden}
				<button
					class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-box bg-base-200/30 p-4 text-center"
					onclick={() => (revealed = true)}
				>
					<span class="badge gap-2 border-base-300 bg-base-100 py-3 badge-lg shadow-md">
						<span aria-hidden="true">👁</span> Спойлер. Нажмите, чтобы открыть
					</span>
				</button>
			{/if}
		</div>
		<ReviewActions {review} />
	{:else if showEntity}
		<p class="mt-2 text-sm text-base-content/50">Оценка без рецензии</p>
	{/if}
	{#if moderate}
		<div class="mt-2">
			<ModerateButton
				label="Удалить рецензию"
				question="Удалить рецензию и оценку?"
				action={async () => {
					await unwrap(
						api.social.DELETE('/api/v1/social/admin/reviews/{id}', {
							params: { path: { id: review.id } }
						})
					);
					await onremoved();
				}}
			/>
		</div>
	{/if}
</article>
