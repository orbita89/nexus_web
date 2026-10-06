# Архитектура

## Стек

|           |                                                                      |
| --------- | -------------------------------------------------------------------- |
| Фреймворк | SvelteKit 3, Svelte 5 (runes), `adapter-node`                        |
| Язык      | TypeScript strict                                                    |
| Стили     | Tailwind CSS 4 + DaisyUI 5, своя тёмная тема `nexus`. Своего CSS нет |
| API       | `openapi-typescript` (типы) + `openapi-fetch` (клиент)               |
| Проверки  | prettier, eslint, svelte-check, vitest (Node + браузер), Playwright  |
| Пакеты    | pnpm                                                                 |

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
    catalog/           разделы (kinds), подписи (labels), состояние списков в URL (url), load-хелперы
    components/        Navbar, Avatar, Alert, AuthCard, ProviderButtons, Stub
      catalog/         Poster, EntityCard, EntityGrid, PosterStrip, Pagination, KindTabs, TagChips,
                       PersonAvatar, RatingSummary, EmptyState, LoadError, Seo
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

Готовы auth, настройки и каталог (главная, разделы, карточки, люди, теги, поиск); социальная
часть (профили, коллекции, форум, лента) — пока заглушки (`Stub`).

## Адреса

Карточка сущности — `/{раздел}/{slug}`: `/films/dune-2021`, `/books/dune`. slug уникален во всём
каталоге, раздел в адресе — для читаемости и SEO. Раздел не совпал с типом сущности — 301 на
правильный адрес (query сохраняется), неизвестный slug — 404.

| Адрес                                  | Что                                                           |
| -------------------------------------- | ------------------------------------------------------------- |
| `/`                                    | новинки по разделам (пустой раздел скрыт), популярные теги    |
| `/films?tag=&year=&q=&offset=`         | раздел (`films`, `series`, `books`, `games`) с фильтрами      |
| `/films/dune-2021`                     | карточка: metadata, теги, участники, сводка оценок (social)   |
| `/people?q=&offset=`, `/people/{slug}` | люди; человек и его работы (одна карточка — все роли)         |
| `/tags`, `/tags/{slug}?kind=&offset=`  | теги; сущности с тегом, фильтр по разделу (`kind` — `films`…) |
| `/search?q=&kind=&offset=`             | поиск (Meilisearch); пустой `q` — подсказка, 503 — сообщение  |

**Состояние списков — в адресе** (`#lib/catalog/url.ts`): фильтры и страница — query-параметры,
пустые значения и `offset=0` не пишутся, смена фильтра сбрасывает страницу. Формы фильтров —
обычные `<form method="GET">`: без JS работают как есть, с JS отправка перехватывается и делается
`goto()` без пустых полей. Пагинация — ссылки `?offset=24`, страница всегда 24 элемента
(делится на 2/3/4/6 колонок). Назад/вперёд и «поделиться ссылкой» работают без доп. кода. Профиль — `/u/{username}` (как в API social:
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

### Загрузка каталога

Данные каталога грузятся в `+page.ts` через `publicApi` — на сервере при первом заходе, в
браузере при переходах. Независимые запросы идут параллельно (`Promise.all`). Хелперы
(`#lib/catalog/load.ts`):

- `orError()` — для карточек: 404 → страница 404, остальное → `+error.svelte`;
- `settle()` — для списков: ошибка → `{ error }`, страница показывает `LoadError` с «Повторить»
  (`invalidateAll`), фильтры остаются на месте. Сводка оценок на карточке тоже через `settle`:
  не загрузилась — карточка показывается без неё.

`hooks.server.ts` разрешает читать на сервере заголовки ответов API `content-length`,
`transfer-encoding`, `retry-after` (`filterSerializedResponseHeaders`): openapi-fetch смотрит
`Content-Length`, без этого любой SSR-запрос падает с `load_response_header_not_serialized`.

SEO: `Seo.svelte` — `<title>`, `meta description` (обрезанное по слову описание), `og:*`.

## API-клиент

- **Типы** генерируются из `../nexus_project/documents/api/{openapi,catalog,social}.json` в
  `src/lib/api/generated/{auth,catalog,social}.ts` (`pnpm api:types`) и коммитятся. CI сверяет их
  с контрактом (`pnpm api:check`). Скрипт сначала проверяет контракт: ссылка на отсутствующую
  схему или повторяющийся `operationId` — падение с перечнем ошибок (чинится в бэкенде).
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
  статусу. Сбой сети — `ApiError(0)`. Для 429 срок берётся из `retry_after` в теле или
  заголовка `Retry-After`: «Попробуйте через 80 с». В компоненте: `catch (e) { error = errorMessage(e) }`.

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
