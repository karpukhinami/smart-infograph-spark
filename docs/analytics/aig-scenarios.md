# AI Infographic Generator — сценарии и событийная разметка

Счётчик Яндекс Метрики: **108472990**.
Область: только публичная главная (`pathname === '/'`). На `/view_all`, `/workspace`, `/prompts`, `/styles`, `/design-profiles` события не отправляются.

Каждое событие дублируется в `dataLayer` и в Метрику:

```js
window.dataLayer.push({ event: "aig_<slug>", ...payload });
ym(108472990, "reachGoal", "aig_<slug>", { "aig_<slug>": payload });
```

Реализация: `src/lib/analytics/yandex-metrika.ts`, `src/lib/analytics/home-events.ts`, `src/components/analytics/HomeYandexMetrika.tsx`, вызовы — в `src/routes/index.tsx`.

---

## Сводка сценариев

| # | Название сценария | Слаг-префикс | Событий | Ключевое событие успеха |
|---|-------------------|--------------|---------|-------------------------|
| 1 | Инициализация генератора | `aig_infographic_generator` | 1 | `aig_infographic_generator_init` |
| 2 | Полная генерация инфографики | `aig_` (воронка) | 4 | `aig_image_generation_success` (`trigger: initial`) |
| 3 | Перегенерация контента | `aig_regen_content` | 2 | `aig_regen_content_success` |
| 4 | Перегенерация изображения | `aig_regen_image` | 2 + 1 воронка | `aig_regen_image_success` |
| 5 | Ручное редактирование контента | `aig_edit` | 4 + 1 воронка | `aig_edit_save` или `aig_edit_save_and_regen_success` |
| 6 | Взаимодействие с изображением | `aig_image` / `aig_version` | 4 (независимые) | `aig_image_rate` |
| 7 | Сброс проекта | `aig_reset` | 2 | `aig_reset_confirm` |

Все сценарии независимы: у каждого свой слаг-префикс, свой набор событий и свои критерии полного/частичного прохождения.

---

## Сценарий 1. Инициализация генератора

| Поле | Значение |
|------|----------|
| Слаг-префикс | `aig_infographic_generator` |
| Страница | `/` |

### События

| Slug | Триггер | Payload |
|------|---------|---------|
| `aig_infographic_generator_init` | Первый визит `/` в сессии, `tag.js` подключён | `page_path`, `entry_url` |

### Критерии

- **Частичное** — не применяется (сценарий одношаговый).
- **Полное** — в сессии на `/` отправлена одна цель `aig_infographic_generator_init`, `mc.yandex.ru/metrika/tag.js?id=108472990` загружен.

### Пример

```js
ym(108472990, "reachGoal", "aig_infographic_generator_init", {
  aig_infographic_generator_init: {
    page_path: "/",
    entry_url: "https://smart-infograph-spark.lovable.app/",
  },
});
```

---

## Сценарий 2. Полная генерация инфографики

| Поле | Значение |
|------|----------|
| Слаг-префикс | `aig_` (воронка генерации) |
| Страница | `/`, форма ввода → экран результатов |

### События (порядок воронки)

| # | Slug | Триггер | Payload |
|---|------|---------|---------|
| 1 | `aig_form_input_start` | Первое взаимодействие с полем формы | `input_name` |
| 2 | `aig_generate_click` | Клик «Сгенерировать инфографику» | `has_source_text`, `has_attached_images`, `subject`, `grade`, `topic_length` |
| 3 | `aig_content_generation_success` | LLM вернул анализ контента | `entity_count`, `has_source_text`, `generation_mode` (`topic_only` \| `with_materials`) |
| 4 | `aig_image_generation_success` | Изображение сгенерировано и отрисовано | `version_number`, `image_versions_count`, `profile_name`, `trigger: "initial"` |

### Критерии

- **Частичное** — цепочка до `aig_content_generation_success` (контент готов, изображение могло упасть).
- **Полное** — все четыре события в одной сессии, финальное — `aig_image_generation_success` с `trigger: "initial"`.

### Пример финального события

```js
ym(108472990, "reachGoal", "aig_image_generation_success", {
  aig_image_generation_success: {
    version_number: 1,
    image_versions_count: 0,
    profile_name: "Стандартная",
    trigger: "initial",
  },
});
```

---

## Сценарий 3. Перегенерация контента

| Поле | Значение |
|------|----------|
| Слаг-префикс | `aig_regen_content` |
| Страница | `/`, панель «Контент» экрана результатов |

### События

| Slug | Триггер | Payload |
|------|---------|---------|
| `aig_regen_content_click` | Открытие диалога «Перегенерировать контент» | — |
| `aig_regen_content_success` | LLM успешно обновил контент | `entity_count`, `has_extra_instructions` |

### Критерии

- **Частичное** — только `aig_regen_content_click` (пользователь открыл диалог, но отменил или получил ошибку).
- **Полное** — `aig_regen_content_click` → `aig_regen_content_success` в одной попытке.

### Пример

```js
ym(108472990, "reachGoal", "aig_regen_content_success", {
  aig_regen_content_success: { entity_count: 5, has_extra_instructions: true },
});
```

---

## Сценарий 4. Перегенерация изображения

| Поле | Значение |
|------|----------|
| Слаг-префикс | `aig_regen_image` |
| Страница | `/`, панель «Итоговое изображение» |

### События

| Slug | Триггер | Payload |
|------|---------|---------|
| `aig_regen_image_click` | Открытие диалога «Перегенерировать изображение» | — |
| `aig_regen_image_success` | Новое изображение готово | `version_number`, `profile_name`, `has_wishes` |
| `aig_image_generation_success` | Дубль в общей воронке изображения | `version_number`, `image_versions_count`, `profile_name`, `trigger: "regen_image"` |

### Критерии

- **Частичное** — `aig_regen_image_click` без успеха.
- **Полное** — `aig_regen_image_click` → `aig_regen_image_success` + `aig_image_generation_success` с `trigger: "regen_image"`.

### Пример

```js
ym(108472990, "reachGoal", "aig_regen_image_success", {
  aig_regen_image_success: { version_number: 2, profile_name: "Стандартная", has_wishes: false },
});
```

---

## Сценарий 5. Ручное редактирование контента

| Поле | Значение |
|------|----------|
| Слаг-префикс | `aig_edit` |
| Страница | `/`, режим «Редактировать вручную» |

### События

| Slug | Триггер | Payload |
|------|---------|---------|
| `aig_edit_mode_enter` | Вход в режим ручного редактирования | — |
| `aig_edit_save` | «Сохранить без перегенерации» | — |
| `aig_edit_save_and_regen_click` | «Сохранить и сгенерировать инфографику» | — |
| `aig_edit_save_and_regen_success` | Изображение пересобрано после правок | `version_number`, `has_wishes` |
| `aig_image_generation_success` | Дубль воронки изображения | `trigger: "regen_after_edit"` |

### Критерии

Две ветки:

- **Ветка «сохранить без картинки»**
  - Частичное — `aig_edit_mode_enter`.
  - Полное — `aig_edit_mode_enter` → `aig_edit_save`.
- **Ветка «сохранить и перегенерировать»**
  - Частичное — `aig_edit_mode_enter` → `aig_edit_save_and_regen_click`.
  - Полное — все шаги до `aig_edit_save_and_regen_success` + `aig_image_generation_success` с `trigger: "regen_after_edit"`.

### Пример

```js
ym(108472990, "reachGoal", "aig_edit_save_and_regen_success", {
  aig_edit_save_and_regen_success: { version_number: 3, has_wishes: true },
});
```

---

## Сценарий 6. Взаимодействие с готовым изображением

| Поле | Значение |
|------|----------|
| Слаг-префикс | `aig_image` / `aig_version` |
| Страница | `/`, панель «Итоговое изображение» и сайдбар версий |

### События (независимые)

| Slug | Триггер | Payload |
|------|---------|---------|
| `aig_image_download` | Скачивание PNG | `version_number` |
| `aig_image_fullscreen_open` | Полноэкранный просмотр по клику | `version_number` |
| `aig_version_switch` | Выбор другой версии в сайдбаре | `from_version`, `to_version` |
| `aig_image_rate` | Оценка like/dislike | `version_number`, `rating` (`like` \| `dislike`) |

### Критерии

- **Частичное** — любое одно из четырёх событий после появления изображения.
- **Полное (обратная связь)** — `aig_image_rate` с заполненным `rating`.
- **Полное (удержание версий)** — `aig_version_switch`, где `from_version !== to_version`.

### Примеры

```js
ym(108472990, "reachGoal", "aig_image_rate", {
  aig_image_rate: { version_number: 1, rating: "like" },
});
ym(108472990, "reachGoal", "aig_version_switch", {
  aig_version_switch: { from_version: 2, to_version: 1 },
});
```

---

## Сценарий 7. Сброс проекта

| Поле | Значение |
|------|----------|
| Слаг-префикс | `aig_reset` |
| Страница | `/`, кнопка «Начать заново» |

### События

| Slug | Триггер | Payload |
|------|---------|---------|
| `aig_reset_click` | Клик «Начать заново» (открытие подтверждения) | — |
| `aig_reset_confirm` | Подтверждение «ОК» в диалоге | — |

### Критерии

- **Частичное** — `aig_reset_click` без подтверждения (пользователь передумал).
- **Полное** — `aig_reset_click` → `aig_reset_confirm`; проект и версии очищены, экран ввода снова активен.

### Пример

```js
ym(108472990, "reachGoal", "aig_reset_confirm", { aig_reset_confirm: {} });
```

---

## Проверка на live

1. Открыть `https://smart-infograph-spark.lovable.app/` (или preview).
2. В Network отфильтровать `mc.yandex.ru` — должен загрузиться `tag.js?id=108472990`.
3. В консоли: `typeof window.ym === "function"` → `true`, `window.dataLayer.map(e => e.event)` содержит `aig_infographic_generator_init`.
4. Пройти сценарии 2–7 и проверить, что в Network появляются запросы `mc.yandex.ru/watch/108472990/...` на каждый `reachGoal`.
