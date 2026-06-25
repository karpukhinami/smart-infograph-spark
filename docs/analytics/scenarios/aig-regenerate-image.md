# Сценарий: Перегенерация изображения

| Поле | Значение |
|------|----------|
| **Название сценария** | Перегенерация итогового изображения |
| **Slug-префикс** | `aig_regen_image` |
| **Страница** | `/` (главная), экран результатов |
| **Счётчик** | 108472990 |

## События

| Slug | Описание | Payload |
|------|----------|---------|
| `aig_regen_image_click` | Клик «Перегенерировать изображение» | — |
| `aig_regen_image_success` | Новое изображение готово | `version_number`, `profile_name`, `has_wishes` |
| `aig_image_generation_success` | Дублирующее событие воронки изображения | `version_number`, `image_versions_count`, `profile_name`, `trigger: "regen_image"` |

## Критерии

### Частичное прохождение

`aig_regen_image_click` — пользователь открыл диалог перегенерации изображения.

### Полное прохождение

`aig_regen_image_click` → подтверждение → `aig_regen_image_success` и `aig_image_generation_success` с `trigger: "regen_image"`.

## Пример

```javascript
ym(108472990, "reachGoal", "aig_regen_image_success", {
  aig_regen_image_success: {
    version_number: 2,
    profile_name: "Стандартная",
    has_wishes: false,
  },
});
```
