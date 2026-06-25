# Сценарий: Взаимодействие с изображением

| Поле | Значение |
|------|----------|
| **Название сценария** | Действия с готовым изображением |
| **Slug-префикс** | `aig_image` / `aig_version` |
| **Страница** | `/` (главная), панель «Итоговое изображение» |
| **Счётчик** | 108472990 |

## События

| Slug | Описание | Payload |
|------|----------|---------|
| `aig_image_download` | Скачивание PNG | `version_number` |
| `aig_image_fullscreen_open` | Полноэкранный просмотр по клику | `version_number` |
| `aig_version_switch` | Выбор другой версии в сайдбаре | `from_version`, `to_version` |
| `aig_image_rate` | Оценка генерации | `version_number`, `rating` (`like` \| `dislike`) |

События независимы — пользователь может выполнить любое подмножество.

## Критерии

### Частичное прохождение

Любое одно из событий сценария после появления изображения на главной.

### Полное прохождение

Для аналитики обратной связи: `aig_image_rate` с заполненным `rating`.  
Для аналитики удержания версий: `aig_version_switch` с разными `from_version` и `to_version`.

## Примеры

```javascript
ym(108472990, "reachGoal", "aig_image_rate", {
  aig_image_rate: { version_number: 1, rating: "like" },
});

ym(108472990, "reachGoal", "aig_version_switch", {
  aig_version_switch: { from_version: 2, to_version: 1 },
});
```
