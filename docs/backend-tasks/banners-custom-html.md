# Баннеры: готовый HTML «как есть» и «везде» = главные страницы (задача бэкенду)

Продолжение `banners-v2.md` (nexus `8003391`).

## 1. Вид `kind: "custom"` — готовый баннер одним HTML

Админ вставляет готовую вёрстку (свои стили, кнопки, заголовки), без отдельных полей
заголовка, кнопок, темы. Сейчас `sanitize_html` (`modules/catalog/src/banners.rs:409`, ammonia)
вырезает `style`, `<style>` и классы не из allowlist, поэтому такой HTML теряет оформление.

- Новое поле `custom_html: string | null`, обязательно при `kind=custom`, ≤ 100 000 символов.
- Для `kind=custom` поля `title` (используется только как подпись в админке), `subtitle`, `image_url`,
  `link_url`, `content_html`, `buttons`, `theme` необязательны и фронтом не показываются.
  `title` стоит сделать необязательным (или оставить обязательным как «название для админки» — фронт
  подставит его в `aria-label`).
- Санитизация мягче, чем у `content_html`, но без исполнения кода:
  - разрешены любые обычные теги вёрстки (включая `div, section, a, img, picture, source, svg`
    и `<style>`), атрибуты `class`, `style`, `id`, `href`, `src`, `srcset`, `alt`, `width`, `height`,
    `aria-*`, `data-*`, `target`, `rel`;
  - запрещены `script`, `iframe`, `object`, `embed`, `form`, `input`, `base`, `meta`, `link`, все `on*`;
    в URL — только `http(s)` и пути `/…` (без `javascript:`, `data:` — кроме `data:image/*` в `img`);
  - в CSS вырезать `expression(`, `javascript:`, `@import`, `url(` с не-http(s) схемой.
- Фронт рендерит `custom_html` в `<iframe sandbox srcdoc>` (без `allow-scripts`, ссылки открываются
  во вкладке/окне через `allow-popups` и `allow-top-navigation-by-user-activation`), так что стили
  баннера не ломают сайт, а сайт — баннер. Поэтому серверная очистка — вторая линия защиты.
- 400 `code:"validation"`, `field:"custom_html"` при пустом/слишком длинном значении.

## 2. `{type:"all"}` — только главные страницы разделов

Сейчас `all` совпадает с любым путём, и баннер «везде» показывается на карточке фильма, в коллекциях
и т. д. Нужно: `all` совпадает только с `/`, `/films`, `/series`, `/books`, `/games`, `/people`.
Для показа на остальных страницах админ явно добавляет `{type:"path", pattern:"/films/*"}` и т. п.

Фронт уже фильтрует это у себя (`safeBanners` в `src/lib/catalog/banners.ts`), но на бэкенде правильнее:
иначе лимит 20 и кэш считаются по баннерам, которые потом выбрасываются.

## Тестовые данные после реализации

Баннер `kind:"custom"`, `targets:[{type:"page", page:"films"}]`, с `<style>` и парой ссылок-кнопок
(например, на `/collections/01a15d5f-31d0-747e-ab81-04e906924d21`) — прислать id.

## Фронт после реализации

Перегенерировать `src/lib/api/generated/catalog.ts`; в `BannerCarousel` — ветка `custom` (sandboxed
iframe, фиксированный aspect-ratio); в админке вид «Готовый HTML» — одна textarea + превью в том же
iframe; убрать фильтр `all` из `safeBanners`.
