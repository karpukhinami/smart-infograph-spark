
## Область изменений

Работаем ТОЛЬКО с `/workspace` и `/styles`. Главная страница (`/`), её флоу и промпты (`simple/design-brief-short.txt`, стиль bento по умолчанию) не трогаются.

## 1. Типы и данные стилей

- В `src/lib/types.ts` в `InfographicStyle` добавить поле `detectionFeatures: string` — текст, описывающий «признаки стиля», по которым модель будет подбирать стиль.
- В `src/data/default-styles.strict.json`:
  - `modern-bento` → в `detectionFeatures` записать текст-заглушку для дефолтного стиля (описание: bento — дефолт, «сжимает» и группирует контент; если модель не считает другие стили подходящими, выбирать этот). Существующие `generalRules`/`specificRules`/`shortDescription` — без изменений.
  - Добавить новый стиль `connection-schema` («Схема связей»), `enabled: false`, `generalRules`/`specificRules` — короткие заглушки, `shortDescription` — заглушка, а `detectionFeatures` — полностью пользовательский текст про причинно-следственные связи, иерархию, циклы, развилки и т.п.
- В `src/data/default-styles.free.json` тоже добавить поле `detectionFeatures: ""` во всех стилях (для совместимости типа), без функционала.

## 2. Страница `/styles`

- Сейчас в `src/routes/styles.tsx` контейнер не скроллится. Обернуть внешний блок в скроллируемый (`min-h-0 overflow-y-auto`), чтобы список стилей прокручивался.
- В `StyleEditor` добавить `Textarea` для `detectionFeatures` под «Конкретные правила», подпись: «Признаки стиля (передаются в подбор стиля)».

## 3. Промпт подбора стиля

- Новый файл `src/data/prompts/strict/detect-style.txt` с описанием задачи: на вход — исходные материалы (тема, предмет, класс, инструкции, текст, изображения) + JSON вида `[{ id, name, detectionFeatures }]` для всех активных стилей. Модель должна вернуть строго JSON:
  ```
  { "styleId": "<id>", "explanation": "<1-2 предложения>" }
  ```
- В `useSettingsStore` в `PromptSet` добавить поле `detectStyle: string`, для `free` = пустая строка, для `strict` — содержимое файла через `?raw`. `setPrompt` уже дженерик, править не нужно.
- `docs/prompts-in-use.md` не трогаем (это не про главную).

## 4. Панель «Стиль инфографики» на шаге 1 в `/workspace`

- В `src/routes/workspace.tsx` после блока «Исходный материал» (и перед `PromptDisclosure` анализа) добавить новую плашку с рамкой:
  - Выпадашка «Стиль инфографики» — из `enabledStyles`. Управляется `selectedStyleId`/`setSelectedStyleId` (уже в store). Дефолт — bento (`"modern-bento"`); если `selectedStyleId` пуст, при монтировании выставить `modern-bento`, если он есть среди активных, иначе первый активный.
  - Кнопка «Определить стиль». Логика:
    1. Собрать `enabledStyles.map(s => ({ id, name, detectionFeatures }))`.
    2. Взять текущий промпт `prompts.detectStyle` и подставить `{{USER_INSTRUCTIONS}}`, `{{SOURCE_TEXT}}` (через `buildSourceTextForPrompt`), `{{TOPIC}}`, `{{SUBJECT}}`, `{{GRADE}}`, `{{STYLES_JSON}}`.
    3. Вызвать `callTextLLMForJson({ model: models.analysis, prompt, label: "detect style", parse: v => v as { styleId: string; explanation: string } })`, `images: attachedImages`.
    4. Если `styleId` есть среди активных стилей — вызвать `setSelectedStyleId`, иначе fallback на bento.
    5. Открыть модалку с текстом `explanation` и единственной кнопкой «ок».
  - Кнопка блокируется если нет источников И нет темы (та же логика что у «Анализировать»).
  - Показать `PromptDisclosure` для промпта detectStyle (можно скрыть под disclosure, чтоб не мешать) — как для остальных промптов.
- Модалка — shadcn `Dialog` с одной кнопкой «ок» (локальный state `detectResult: { explanation } | null`).

## 5. Что НЕ меняется

- Логика `onAnalyze` остаётся как есть — она уже использует `selectedStyleId` при формировании `summary.recommendedStyle`.
- Панель шага 2 в `/workspace` со «Стиль инфографики» остаётся (она общий контрол через `selectedStyleId`; выбор в шаге 1 автоматически предзаполнит шаг 2).
- Главная страница (`/`) — без изменений вообще.

## Технические детали

- Файл промпта импортируется в `useSettingsStore` через `?raw` так же, как `promptStrictAnalysisWith`.
- Версию `persist` в `useSettingsStore` (сейчас `23`) поднять до `24` — форма `PromptSet` и `InfographicStyle` меняется, миграция уже возвращает `undefined` (сбрасывает состояние).
- В `EntityEditDialog` и остальных потребителях `InfographicStyle` поле `detectionFeatures` не используется — только редактор стилей и промпт подбора.
