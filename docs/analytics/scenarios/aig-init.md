# Сценарий: Инициализация главной

| Поле | Значение |
|------|----------|
| **Название сценария** | Инициализация генератора инфографики |
| **Slug-префикс** | `aig_infographic_generator` |
| **Страница** | `/` (главная) |
| **Счётчик** | 108472990 |

## События

| Slug | Описание | Payload |
|------|----------|---------|
| `aig_infographic_generator_init` | Пользователь открыл главную; счётчик инициализирован | `page_path`, `entry_url` |

## Критерии

### Частичное прохождение

Не применяется — сценарий одношаговый.

### Полное прохождение

Пользователь загрузил `/`, скрипт `mc.yandex.ru/metrika/tag.js` подключён, в сессии отправлена одна цель `aig_infographic_generator_init`.

## Пример

```javascript
ym(108472990, "reachGoal", "aig_infographic_generator_init", {
  aig_infographic_generator_init: {
    page_path: "/",
    entry_url: "https://smart-infographics-generator.onrender.com/",
  },
});
```

## Аналог в LPC

`lpc_lesson_plan_constructor_init` — init-goal при первом заходе на конструктор УП.
