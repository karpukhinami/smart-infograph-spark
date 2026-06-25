# Сценарий: Ручное редактирование контента

| Поле | Значение |
|------|----------|
| **Название сценария** | Редактирование контента и опциональная перегенерация |
| **Slug-префикс** | `aig_edit` |
| **Страница** | `/` (главная), панель «Контент» |
| **Счётчик** | 108472990 |

## События

| Slug | Описание | Payload |
|------|----------|---------|
| `aig_edit_mode_enter` | Вход в режим «Редактировать вручную» | — |
| `aig_edit_save` | «Сохранить без перегенерации» | — |
| `aig_edit_save_and_regen_click` | «Сохранить и сгенерировать инфографику» | — |
| `aig_edit_save_and_regen_success` | Изображение пересобрано после правок | `version_number`, `has_wishes` |
| `aig_image_generation_success` | Событие воронки изображения | `trigger: "regen_after_edit"` |

## Критерии

### Частичное прохождение (ветка без перегенерации)

`aig_edit_mode_enter` → `aig_edit_save` — пользователь отредактировал и сохранил контент без нового изображения.

### Частичное прохождение (ветка с перегенерацией)

`aig_edit_mode_enter` → `aig_edit_save_and_regen_click` — начата перегенерация после правок.

### Полное прохождение (ветка с перегенерацией)

Все шаги до `aig_edit_save_and_regen_success` и `aig_image_generation_success` с `trigger: "regen_after_edit"`.

## Пример

```javascript
ym(108472990, "reachGoal", "aig_edit_save_and_regen_success", {
  aig_edit_save_and_regen_success: {
    version_number: 3,
    has_wishes: true,
  },
});
```
