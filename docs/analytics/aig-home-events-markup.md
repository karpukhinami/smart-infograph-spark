# Событийная разметка — главная страница (/)

Счётчик Яндекс Метрики: **108472990**.

Область действия: только публичная главная (`pathname === '/'`).  
Не отправляется на `/view_all`, `/workspace`, `/prompts`, `/styles` и других маршрутах.

Префикс целей: `aig_` (AI Infographic Generator).

## Формат отправки

Каждое событие дублируется в `dataLayer` и в Метрику:

```javascript
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({ event: "aig_<slug>", ...payload });

ym(108472990, "reachGoal", "aig_<slug>", { aig_<slug>: payload });
```

## Сводная таблица событий

| Slug | Сценарий | Триггер |
|------|----------|---------|
| `aig_infographic_generator_init` | [init](./scenarios/aig-init.md) | Первый визит `/` в сессии |
| `aig_form_input_start` | [full-generation](./scenarios/aig-full-generation.md) | Первое взаимодействие с формой |
| `aig_generate_click` | [full-generation](./scenarios/aig-full-generation.md) | Клик «Сгенерировать инфографику» |
| `aig_content_generation_success` | [full-generation](./scenarios/aig-full-generation.md) | Успешный анализ контента |
| `aig_image_generation_success` | [full-generation](./scenarios/aig-full-generation.md) | Успешная генерация изображения |
| `aig_regen_content_click` | [regenerate-content](./scenarios/aig-regenerate-content.md) | Открытие диалога перегенерации контента |
| `aig_regen_content_success` | [regenerate-content](./scenarios/aig-regenerate-content.md) | Успешная перегенерация контента |
| `aig_regen_image_click` | [regenerate-image](./scenarios/aig-regenerate-image.md) | Открытие диалога перегенерации изображения |
| `aig_regen_image_success` | [regenerate-image](./scenarios/aig-regenerate-image.md) | Успешная перегенерация изображения |
| `aig_edit_mode_enter` | [edit-content](./scenarios/aig-edit-content.md) | Вход в ручное редактирование |
| `aig_edit_save` | [edit-content](./scenarios/aig-edit-content.md) | Сохранение без перегенерации |
| `aig_edit_save_and_regen_click` | [edit-content](./scenarios/aig-edit-content.md) | Клик «Сохранить и сгенерировать» |
| `aig_edit_save_and_regen_success` | [edit-content](./scenarios/aig-edit-content.md) | Успех после сохранения и перегенерации |
| `aig_image_download` | [image-engagement](./scenarios/aig-image-engagement.md) | Скачивание PNG |
| `aig_image_fullscreen_open` | [image-engagement](./scenarios/aig-image-engagement.md) | Полноэкранный просмотр |
| `aig_version_switch` | [image-engagement](./scenarios/aig-image-engagement.md) | Переключение версии в сайдбаре |
| `aig_image_rate` | [image-engagement](./scenarios/aig-image-engagement.md) | Оценка like/dislike |
| `aig_reset_click` | [reset](./scenarios/aig-reset.md) | Клик «Начать заново» |
| `aig_reset_confirm` | [reset](./scenarios/aig-reset.md) | Подтверждение сброса |

## Реализация в коде

- `src/lib/analytics/yandex-metrika.ts` — загрузка счётчика, `sendReachGoal`, guard по `/`
- `src/lib/analytics/home-events.ts` — типизированные хелперы событий
- `src/components/analytics/HomeYandexMetrika.tsx` — init + init-goal на главной
- `src/routes/index.tsx` — вызовы событий (только при `pathname === '/'`)

## Проверка на live

1. Открыть `https://smart-infographics-generator.onrender.com/`
2. В Network → фильтр `mc.yandex.ru` — должен загрузиться `tag.js?id=108472990`
3. После загрузки страницы — goal `aig_infographic_generator_init` (аналог `lpc_lesson_plan_constructor_init` у LPC)
