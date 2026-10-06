<script lang="ts">
	import { OAUTH_NEXT_KEY, providerTitle } from '#lib/auth/oauth.ts';

	/** Включённые провайдеры (GET /oauth/providers). Пусто — блока нет (так в dev). */
	let { providers, next = '/' }: { providers: string[]; next?: string } = $props();

	function remember() {
		sessionStorage.setItem(OAUTH_NEXT_KEY, next);
	}
</script>

{#if providers.length > 0}
	<div class="divider my-0 text-sm text-base-content/60">или</div>
	<div class="flex flex-col gap-2">
		{#each providers as provider (provider)}
			<!-- Переход к провайдеру — полная навигация браузера, не fetch (auth.md). -->
			<a
				href="/api/v1/auth/oauth/{provider}/start"
				data-sveltekit-reload
				class="btn btn-outline"
				onclick={remember}
			>
				Войти через {providerTitle(provider)}
			</a>
		{/each}
	</div>
{/if}
