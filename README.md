# Nexus Web

Веб-фронтенд [Nexus](../nexus_project): каталог фильмов, сериалов, книг и игр и социальная сеть
вокруг них. SvelteKit 3 (Svelte 5), TypeScript, Tailwind CSS + DaisyUI.

Бэкенд — отдельный репозиторий `nexus_project` (Rust, REST + JSON). Документы «что и зачем» — в
[docs/](docs/README.md).

## Запуск

Нужны Node.js 22+, pnpm и поднятый бэкенд.

```sh
# бэкенд (соседний каталог)
cd ../nexus_project && make up && make seed

# фронтенд
pnpm install
pnpm dev            # http://localhost:5173
```

Vite проксирует `/api` и `/ws` на бэкенд (`http://localhost`, переопределяется `BACKEND_URL`):
у бэкенда нет CORS, и в проде фронтенд и API будут на одном домене за nginx.

**Ссылки из писем в dev.** Бэкенд строит ссылки от `APP_BASE_URL` (по умолчанию `http://localhost`,
а это сам бэкенд). Чтобы ссылки из Mailpit открывали фронтенд, добавьте в `../nexus_project/infra/.env`:

```sh
APP_BASE_URL=http://localhost:5173
```

и перезапустите `make up`. Письма — в Mailpit: http://localhost:8025.

Тестовые пользователи: `admin`, `author`, `user`, пароль `password123`.

## Команды

| Команда                       | Что делает                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                    | Dev-сервер с прокси на бэкенд                                                       |
| `pnpm build` / `pnpm preview` | Сборка со статикой всех карточек в `build/prerendered` (нужен бэкенд) / запуск      |
| `pnpm start`                  | Прод-сервер с ISR карточек (`ISR_SECRET`), за nginx — `deploy/nginx.conf`           |
| `pnpm revalidate <адреса>`    | Перерисовать карточки на работающем сервере; `--all` — весь каталог (`ISR_SECRET`)  |
| `pnpm verify`                 | **Всё, что проверяет CI:** prettier + eslint, svelte-check, unit-тесты, сборка, e2e |
| `pnpm lint` / `pnpm format`   | Проверить / исправить форматирование и eslint                                       |
| `pnpm check`                  | svelte-check (типы; предупреждения считаются ошибками)                              |
| `pnpm test:unit`              | Vitest: логика (Node) и компоненты (Chromium)                                       |
| `pnpm test:e2e`               | Playwright против поднятого бэкенда и Mailpit                                       |
| `pnpm api:types`              | Перегенерировать типы API из `../nexus_project/documents/api/*.json`                |
| `pnpm api:check`              | Проверить, что типы совпадают с контрактом (в CI)                                   |

Путь к бэкенду для `api:*` — `NEXUS_BACKEND_DIR` (по умолчанию `../nexus_project`).

Первый запуск тестов: `pnpm exec playwright install chromium`.

**E2E и лимиты входа.** Бэкенд ограничивает вход: 10 попыток на аккаунт, 30 запросов входа и писем
в минуту с IP. Тесты идут в один поток, адреса уникальны на каждый прогон, в сценарии не больше
одного входа. Не добавляйте вход в цикле или в `beforeEach`.

## CI

GitHub Actions (`.github/workflows/ci.yml`): проверки, unit, сборка и сверка типов с контрактом;
отдельной задачей — бэкенд из `docker compose` и e2e. Бэкенд берётся из `orbita89/nexus_project`;
если репозиторий приватный, нужен секрет `BACKEND_REPO_TOKEN` (fine-grained token, Contents: read).
