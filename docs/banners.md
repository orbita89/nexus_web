# Баннеры страниц (задача для фронтенда)

Бэкенд готов (nexus `80b3e21`). Баннеры (промо, новости) настраиваются в админке, у каждой страницы свой набор.

## API

Публично, без токена:

```
GET /api/v1/catalog/banners?page=<page>
```

- `page`: `home` | `films` | `series` | `books` | `games` | `people`; другое значение → 400.
- Ответ: массив `Banner[]` (не `Page`), не больше 20, уже отсортирован по `position`. Отдаются только активные баннеры в периоде показа, фильтровать на клиенте не надо.

```ts
type Banner = {
	id: string; // uuid
	page: string;
	title: string; // до 300 символов
	subtitle: string | null;
	image_url: string; // http(s)
	link_url: string | null; // http(s)://… или путь сайта "/films/dune-2021"
	position: number;
	is_active: boolean;
	starts_at: string | null; // ISO
	ends_at: string | null;
	created_at: string;
	updated_at: string;
};
```

Админка (токен админа; 401 без токена, 403 не админ, 400 валидация, 404 нет id):

| Метод  | Путь                                                 | Тело / ответ                                                                                                        |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/catalog/admin/banners?page=&limit=&offset=` | `Page<Banner>` (все, включая выключенные)                                                                           |
| POST   | `/api/v1/catalog/admin/banners`                      | `{page, title, image_url, subtitle?, link_url?, position?=0, is_active?=true, starts_at?, ends_at?}` → 201 `Banner` |
| PATCH  | `/api/v1/catalog/admin/banners/{id}`                 | любые поля; `null` очищает `subtitle`, `link_url`, `starts_at`, `ends_at` → 200 `Banner`                            |
| DELETE | `/api/v1/catalog/admin/banners/{id}`                 | 204                                                                                                                 |

Правила: `ends_at > starts_at`; `image_url` только http(s); `link_url` — http(s) или путь с `/` (не `//`).

Событий (SSE/WS) нет: страница просто запрашивает список при загрузке.

## Что сделать

1. **API-клиент:** `getBanners(page)` и админские `list/create/update/delete`.
2. **Компонент `BannerCarousel`** (Tailwind + DaisyUI `carousel`), вверху страниц:
   - главная → `home`; фильмы → `films`; сериалы → `series`; книги → `books`; игры → `games`; люди → `people`;
   - загрузка в `+page.server.ts` (SSR, публичные страницы); ошибка или пустой массив → блок не показывать, страница не должна падать;
   - картинка на всю ширину (фиксированный `aspect-ratio`, `object-cover`, `loading="lazy"` кроме первого слайда), поверх — `title` и `subtitle`;
   - `link_url`: путь `/…` → внутренняя ссылка SvelteKit, `http(s)` → `target="_blank" rel="noopener"`; без ссылки — баннер не кликабелен;
   - несколько баннеров → автопрокрутка (пауза при hover и `prefers-reduced-motion`), точки и стрелки; один баннер → без управления.
3. **Админка `/admin/banners`:**
   - таблица с фильтром по странице и пагинацией;
   - форма создания и редактирования: страница (select из 6 значений), заголовок, подзаголовок, URL картинки с превью, ссылка, позиция, активность, период показа (datetime-local → ISO);
   - удаление с подтверждением в интерфейсе;
   - ошибки 400 показывать у формы (`{"error","code"}`).
4. `pnpm verify`.

Для проверки на бэкенде создан тестовый баннер для `films` (заголовок «Тестовый баннер»).
