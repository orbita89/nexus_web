# Архитектура

## Стек

|           |                                                                         |
| --------- | ----------------------------------------------------------------------- |
| Фреймворк | SvelteKit 3, Svelte 5 (runes), `adapter-node`                           |
| Язык      | TypeScript strict                                                       |
| Стили     | Tailwind CSS 4 + DaisyUI 5, тема `dark`. Своего CSS нет — только классы |
| API       | `openapi-typescript` (типы) + `openapi-fetch` (клиент)                  |
| Проверки  | prettier, eslint, svelte-check, vitest (Node + браузер), Playwright     |
| Пакеты    | pnpm                                                                    |

Особенности SvelteKit 3, на которые легко наткнуться:

- конфиг — в `vite.config.ts` (`sveltekit({ adapter })`), `svelte.config.js` нет;
- вместо `$lib` — subpath imports: `#lib/...` **с расширением** (`#lib/api/errors.ts`);
- матчеры параметров — `src/params.ts` (`defineParams`), переменные окружения — `src/env.ts`
  (`defineEnvVars`, читаются из `$app/env/private`), `browser` — из `$app/env`;
- типы хуков — из `@sveltejs/kit/hooks`.

## Структура

```
src/
  env.ts               переменные окружения (BACKEND_URL)
  params.ts            матчер kind: films | series | books | games
  hooks.server.ts      SSR: запросы /api/... с сервера → BACKEND_URL
  lib/
    api/               клиенты, ошибки, generated/ — типы из OpenAPI (не править руками)
    auth/              токены и сессия (core.ts — без Svelte, session.svelte.ts — для компонентов)
    catalog/           разделы каталога (адрес ↔ тип сущности)
    components/        Navbar, Avatar, Alert, AuthCard, ProviderButtons, Stub
    utils/             safeNext, loginUrl
  routes/
    +layout.svelte     шапка, контейнер, подвал
    [kind=kind]/       /films, /series, /books, /games и карточка /films/dune-2021
    people/ tags/ search/
    u/[username]/      профиль и вкладки: reviews, collections, threads, followers, following
    collections/ forum/
    (protected)/       только для вошедших, без SSR: feed, forum/new, settings/*
    auth/              вход, регистрация, ссылки из писем, OAuth — без SSR
e2e/                   Playwright: сценарии против живого бэкенда, Mailpit
scripts/api-types.mjs  генерация типов API
```

Всё, кроме auth и настроек, пока заглушки (`Stub`).

## Адреса

Карточка сущности — `/{раздел}/{slug}`: `/films/dune-2021`, `/books/dune`. slug уникален во всём
каталоге, раздел в адресе — для читаемости и SEO. Профиль — `/u/{username}` (как в API social:
пользователи адресуются по username).

## SSR и что где рендерится

Токены живут только в браузере (см. [auth.md](auth.md)), поэтому сервер всегда рендерит страницу
**как для гостя**:

| Что                                                              | Где                            |
| ---------------------------------------------------------------- | ------------------------------ |
| Каталог, люди, теги, поиск, форум, публичные профили и коллекции | SSR (SEO), публичные данные    |
| Личное на этих страницах: моя оценка, «Подписаться», «Следить»   | догружается в браузере         |
| Лента, настройки, создание темы — группа `(protected)`           | только браузер (`ssr = false`) |
| Вход, регистрация, ссылки из писем — `auth/`                     | только браузер                 |

## API-клиент

- **Типы** генерируются из `../nexus_project/documents/api/{openapi,catalog,social}.json` в
  `src/lib/api/generated/{auth,catalog,social}.ts` (`pnpm api:types`) и коммитятся. CI сверяет их
  с контрактом (`pnpm api:check`). Скрипт обходит две ошибки контрактов: ссылки на отсутствующие
  схемы и повторяющиеся `operationId` (см. [backend-questions.md](backend-questions.md)).
- **Клиенты** — по одному на контракт: `api.auth`, `api.catalog`, `api.social`. Пути полные:
  `api.social.GET('/api/v1/social/users/{username}', { params: { path: { username } } })`.
- Какой клиент брать:
  - `api` (`#lib/auth/session.svelte.ts`) — в браузере от имени пользователя: Bearer, обновление
    токена, повтор на 401;
  - `guestApi` — вход, регистрация, ссылки из писем: без токена;
  - `publicApi(fetch, url)` (`#lib/api/client.ts`) — в `+page.ts`, публичные данные. На сервере
    запрос идёт на `url.origin/api/...`, а `handleFetch` отправляет его на `BACKEND_URL`.
- **Ошибки.** Бэкенд всегда отвечает `{"error": "..."}` — по-английски и без кодов. `unwrap()`
  превращает ответ в данные или `ApiError { status, serverMessage, message }`, где `message` —
  текст для пользователя: известные сообщения переводятся словарём (`errors.ts`), остальные — по
  статусу. Сбой сети — `ApiError(0)`. В компоненте: `catch (e) { error = errorMessage(e) }`.

## Прокси и окружение

| Где                        | /api и /ws                                                               |
| -------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`, `pnpm preview` | прокси Vite → `BACKEND_URL` (по умолчанию `http://localhost`)            |
| SSR (сервер SvelteKit)     | `handleFetch` → `BACKEND_URL`                                            |
| прод                       | тот же домен, nginx (позже: фронтенд — отдельный сервис за тем же nginx) |

Docker для фронтенда пока не делаем — появится вместе с деплоем (образ `adapter-node`).

## Язык

Интерфейс только на русском, строки прямо в компонентах. i18n (Paraglide) подключим, когда
понадобится второй язык.
