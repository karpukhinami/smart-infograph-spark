## Цель

Добавить в строгий режим переключатель «дизайн-бриф / технический макет» на шаге 2. В положении «технический макет» вместо генерации изображения ИИ создаётся ProgrammaticRenderSpec JSON, который детерминированно рисуется встроенным React-рендерером и показывается на вкладке «Каркас».

## UX-изменения

- Шаг 2: добавляется Tabs «Дизайн-бриф | Технический макет» сверху плашки.
  - «Дизайн-бриф» — текущее поведение, всё как есть.
  - «Технический макет» — та же плашка (выбор стиля, профиля, ModelPicker для `models.brief`, PromptDisclosure), но используется промпт из `src/data/prompts/strict/code-based-product.txt`. Кнопка: «Создать технический макет».
- Шаг 3 в режиме «технический макет» скрывается (рендерер сам делает финал, генерация изображения ИИ не нужна).
- Результат показывается на вкладке **«Каркас»** (т.к. это векторная DOM-структура, а не растровое изображение). Сверху вкладки — компактная панель «Экспорт PNG» (через `html-to-image`) и кнопка «Перегенерировать».
- На вкладке «Каркас» включается соответствующий вид: либо текущий `WireframeSketch/WireframeView` (для дизайн-брифа), либо новый `ProgrammaticRenderer` (для технического макета).
- Список layout-warnings показывается под рендером в свернутой секции.

## Хранение

`useProjectStore`:
- Новый тип режима шага 2: `briefMode: "design" | "programmatic"`, persisted, по умолчанию `"design"`.
- Новый массив версий: `specVersions: Versioned<ProgrammaticRenderSpec>[]`, `activeSpecId`, `pushSpec`, `setActiveSpec`. Параллельно `briefVersions` (не смешиваем форматы).
- `PaneMode` остаётся `content | wireframe | image`; в programmatic-ветке открывается `wireframe`.

`useSettingsStore`:
- Добавить в `prompts.strict` поле `codeBasedProduct`, заполняется содержимым `code-based-product.txt`. Версия persisted-стора инкрементируется.

## Промпт и LLM-вызов

Новая функция `onCreateProgrammaticSpec()` в `src/routes/index.tsx`:
- Заполняет плейсхолдеры в `prompts.codeBasedProduct` через расширенный `buildDesignBriefPrompt` (используем существующий, он уже подставляет `GENERAL_RULES_BLOCK`, `STYLE_*`, `DESIGN_PROFILE_PROSE`, `CONTENT_SUMMARY`, `USER_WISHES`).
- Зовёт `callTextLLMForJson` с моделью `models.brief`, парсит и валидирует через `validateRenderSpec`.
- При ошибке валидации — показывает первую проблему toast-ом + сохраняет сырой ответ для отладки.

## Рендерер

Новые файлы:

- `src/lib/render-spec/types.ts` — TS-типы `ProgrammaticRenderSpec`, `RenderRow`, `RenderCard`, `ColorRef`, `AddOnPlacement`, `TitleStyle`, `GroupContainer`, `Theme`, `Header` строго по спецификации промпта.
- `src/lib/render-spec/validate.ts` — `validateRenderSpec(value, designProfile): { spec, warnings }`. Проверяет:
  - наличие корневого `ProgrammaticRenderSpec`, `format`, `theme`, `header`, `rows`;
  - `format.orientation ∈ {portrait, landscape}`, `aspectRatio` соответствует;
  - `rows` непустой; для каждого row: `id`, `role`, `heightWeight>0`, `cardCount`, `columnRatio` из белого списка `1|1:1|1:2|2:1|1:1:1|2:1:1|1:2:1|1:1:2`, `cards.length === cardCount`, `cardCount` соответствует количеству долей в `columnRatio`;
  - все hex входят в палитру `designProfile` (pageBackground + brightAccents + pastelFills + structural; case-insensitive);
  - запрет полей `icon`, `visual`;
  - `groupContainer === null` если `cardCount === 1`;
  - все строки `formula` обёрнуты в `$...$` или `$$...$$` (warning, не fatal, если нет).
  - Возвращает либо валидный spec, либо бросает `Error` с понятным сообщением.
- `src/lib/render-spec/tokens.ts` — таблицы margin/gap/density/radius/border/shadow/text-scale из ТЗ (точные числа из спецификации).
- `src/lib/render-spec/layout.ts` — чистые функции:
  - `computeCanvas(format)` → 1200×1600 / 1600×1200, `base`.
  - `parseRatio(columnRatio)` → number[].
  - `computeRowHeights(rows, canvasHeight, margin, gap)`.
  - `computeCardWidths(row, canvasWidth, margin, gap)`.
  - `resolveDensity`, `resolveRadius`, `cardPadding`, `blockGap` из density preset.
- `src/lib/render-spec/fit-text.ts` — `useFitText({ baseFontSize, minFontSize, contentRef, containerRef })` — бинарный поиск размера, измеряет `scrollHeight/clientHeight` и `scrollWidth/clientWidth`. Хук вызывается после рендера через `useLayoutEffect`.
- `src/components/render-spec/ProgrammaticRenderer.tsx` — корневой компонент:
  - принимает `spec`, рендерит фиксированный canvas с CSS-переменными темы;
  - использует `transform: scale(...)` через wrapper по ширине контейнера, не меняя внутренний layout;
  - рисует header → rows → groupContainer? → cards.
- `src/components/render-spec/Card.tsx` — карточка: background/border/shadow/radius/padding из card-level или theme; вертикальный flex с blockGap; зоны title/body/formula/example; применяет fillStrategy (`air | centerContent | scaleText | accentShape | largeFormula`); вызывает fit-text для body, formula считается отдельно.
- `src/components/render-spec/AddOnContainer.tsx` — варианты inset/badge/plate, layout single/horizontalGroup.
- `src/components/render-spec/CardContent.tsx` — `react-markdown` + `remark-math` + `rehype-katex` для body и formula/example. Поддержка строка | массив строк (массив → набор `<p>`/`<li>` сохраняя порядок).
- `src/components/render-spec/RowTitle.tsx`.
- `src/components/render-spec/LayoutWarnings.tsx` — собирает предупреждения через React context (`useLayoutWarnings`), отображает список под рендером.

### Поведение fit-text и warnings

- shared/independent/hierarchical textSizing реализуется через context на уровне Row: каждая карточка регистрирует свой подобранный fontSize, после первого прохода Row выставляет общий минимум и форсит re-render для shared/hierarchical.
- При overflow-цепочке: уменьшить fontSize → blockGap → padding → пометить карточку failed (visual overlay в режиме отладки `uiMode === "debug"`, иначе только в LayoutWarnings).

### Экспорт

- `bun add html-to-image katex react-katex remark-math rehype-katex react-markdown` (react-markdown скорее всего уже есть, проверить; добавить только недостающее).
- Кнопка «Экспорт PNG» зовёт `toPng(canvasRef.current, { pixelRatio: 2 })`, скачивает blob.

## Файлы, которые редактируем

- `src/store/useProjectStore.ts` — `briefMode`, `specVersions`, version bump.
- `src/store/useSettingsStore.ts` — `prompts.strict.codeBasedProduct`, version bump.
- `src/routes/index.tsx` — Tabs на шаге 2, `onCreateProgrammaticSpec`, скрытие шага 3 в programmatic-ветке, переключение содержимого вкладки «Каркас».
- `src/components/workspace/WireframeView.tsx` — без изменений.
- Новые файлы (см. выше).

## Технические детали

- Все числовые константы margin/gap/density/radius/border/text-scale берутся ровно из таблиц в задаче.
- Нет смешивания типов: `briefVersions` (старый формат) и `specVersions` (новый) живут параллельно. На вкладке «Каркас» отображаем тот, что соответствует текущему `briefMode`.
- LaTeX-экранирование в JSON уже обрабатывается на стороне `llm-json` (json-repair). Дополнительно перед парсингом KaTeX-формула остаётся как есть.
- Соответствие вкладок: технический макет — векторный DOM → вкладка «Каркас» (как и просил пользователь — «если векторная структура, то можно вписать в каркас»).

## Открытые вопросы

Реализую как описано, если возражений нет.
