<script lang="ts">
	import { errorMessage, unwrap } from '#lib/api/errors.ts';
	import type { SchemaRole, SchemaUserView } from '#lib/api/generated/auth.ts';
	import { api, session } from '#lib/auth/session.svelte.ts';
	import { reviewDate } from '#lib/social/reviews.ts';
	import Alert from '#lib/components/Alert.svelte';
	import Avatar from '#lib/components/Avatar.svelte';

	// Пользователи: роль и блокировка. Себя не понизить и не заблокировать (бэкенд тоже не даст).
	const PAGE = 50;
	const ROLES: { value: SchemaRole; title: string }[] = [
		{ value: 'user', title: 'Пользователь' },
		{ value: 'author', title: 'Автор' },
		{ value: 'admin', title: 'Админ' }
	];

	let users = $state<SchemaUserView[]>([]);
	let more = $state(false);
	let loading = $state(false);
	let error = $state('');
	let busy = $state<string | null>(null);

	async function load(offset: number) {
		loading = true;
		error = '';
		try {
			// Контракт ошибочно описывает limit/offset как параметры пути (backend-questions):
			// передаём их запросом в обход типов. total в ответе нет — «ещё», пока страница полная.
			const page = await unwrap<SchemaUserView[]>(
				api.auth.GET('/api/v1/auth/admin/users', {
					params: { query: { limit: PAGE, offset } }
				} as never)
			);
			users = offset ? [...users, ...page] : page;
			more = page.length === PAGE;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}
	void load(0);

	async function update(user: SchemaUserView, change: { role?: SchemaRole; is_active?: boolean }) {
		busy = user.id;
		error = '';
		try {
			const path = { id: user.id };
			const updated = await unwrap(
				change.role
					? api.auth.PATCH('/api/v1/auth/admin/users/{id}/role', {
							params: { path },
							body: { role: change.role }
						})
					: api.auth.PATCH('/api/v1/auth/admin/users/{id}/status', {
							params: { path },
							body: { is_active: change.is_active! }
						})
			);
			users = users.map((u) => (u.id === updated.id ? updated : u));
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = null;
		}
	}
</script>

<svelte:head><title>Пользователи — Админка — Nexus</title></svelte:head>

<h1 class="mb-2 text-3xl font-black">Пользователи</h1>
<p class="mb-6 text-sm text-base-content/60">
	Автор может создавать темы на форуме, админ — всё, включая эту страницу. Блокировка завершает все
	сессии пользователя; его рецензии и сообщения остаются.
</p>

{#if error}<div class="mb-4"><Alert>{error}</Alert></div>{/if}

<div class="overflow-x-auto rounded-box ring-1 ring-base-300">
	<table class="table">
		<thead>
			<tr><th>Пользователь</th><th>Email</th><th>Роль</th><th>Статус</th><th>С нами</th></tr>
		</thead>
		<tbody>
			{#each users as user (user.id)}
				{@const self = user.id === session.user?.id}
				<tr class={{ 'opacity-60': !user.is_active }}>
					<td>
						<a href="/u/{user.username}" class="flex items-center gap-2 hover:text-primary">
							<Avatar {user} size="w-8" />
							<span>
								<span class="block font-semibold">{user.display_name || user.username}</span>
								<span class="block text-xs text-base-content/50">@{user.username}</span>
							</span>
						</a>
					</td>
					<td class="text-sm">{user.email}</td>
					<td>
						<label class="select w-36 select-sm">
							<span class="sr-only">Роль @{user.username}</span>
							<select
								value={user.role}
								disabled={self || busy === user.id}
								onchange={(e) => update(user, { role: e.currentTarget.value as SchemaRole })}
							>
								{#each ROLES as role (role.value)}
									<option value={role.value}>{role.title}</option>
								{/each}
							</select>
						</label>
					</td>
					<td>
						{#if self}
							<span class="text-xs text-base-content/50">это вы</span>
						{:else}
							<button
								class={['btn btn-xs', user.is_active ? 'btn-ghost text-error' : 'btn-success']}
								disabled={busy === user.id}
								onclick={() => update(user, { is_active: !user.is_active })}
								aria-label="{user.is_active ? 'Заблокировать' : 'Разблокировать'} @{user.username}"
								>{user.is_active ? 'Заблокировать' : 'Разблокировать'}</button
							>
						{/if}
					</td>
					<td class="text-xs whitespace-nowrap text-base-content/50"
						>{reviewDate(user.created_at)}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
{#if more}
	<div class="mt-4 flex justify-center">
		<button class="btn btn-sm" onclick={() => load(users.length)} disabled={loading}
			>Показать ещё</button
		>
	</div>
{/if}
