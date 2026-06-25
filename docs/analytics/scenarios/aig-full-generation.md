# Сценарий: Полная генерация инфографики

| Поле | Значение |
|------|----------|
| **Название сценария** | Полная генерация (контент + изображение) |
| **Slug-префикс** | `aig_` (воронка генерации) |
| **Страница** | `/` (главная) |
| **Счётчик** | 108472990 |

## События (порядок воронки)

| # | Slug | Описание | Payload |
|---|------|----------|---------|
| 1 | `aig_form_input_start` | Первое взаимодействие с полем формы | `input_name` |
| 2 | `aig_generate_click` | Клик «Сгенерировать инфографику» | `has_source_text`, `has_attached_images`, `subject`, `grade`, `topic_length` |
| 3 | `aig_content_generation_success` | LLM вернул анализ контента | `entity_count`, `has_source_text`, `generation_mode` (`topic_only` \| `with_materials`) |
| 4 | `aig_image_generation_success` | Изображение сгенерировано и показано | `version_number`, `image_versions_count`, `profile_name`, `trigger: "initial"` |

## Критерии

### Частичное прохождение

Цепочка до `aig_content_generation_success` включительно: пользователь заполнил форму, нажал генерацию, контент успешно сформирован (даже если изображение упало с ошибкой).

### Полное прохождение

Все четыре события в одной сессии на `/`, финальное — `aig_image_generation_success` с `trigger: "initial"`.

## Пример финального события

```javascript
ym(108472990, "reachGoal", "aig_image_generation_success", {
  aig_image_generation_success: {
    version_number: 1,
    image_versions_count: 0,
    profile_name: "Стандартная",
    trigger: "initial",
  },
});
```
