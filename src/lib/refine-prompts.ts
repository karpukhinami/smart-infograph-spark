// Prompts used by the "Refine with AI" dialog at each stage.

export const ENTITY_TYPES_LIST = `mainIdea, definition, rule, principle, theorem, property, criterion, consequence, formula, example, classification, comparison, algorithm, solutionStep, taskCondition, given, goal, warning, commonMistake, mnemonic, checklist, visualCore, diagram, conclusion, quote, etymology`;

export function buildRefineContentPrompt(opts: {
  userInstructions: string;
  currentAnalysisJson: string;
  currentContentText: string;
  strict: boolean;
}): string {
  const { userInstructions, currentAnalysisJson, currentContentText, strict } = opts;
  return `Ты — методист-редактор. Тебе уже передан результат предыдущего анализа учебного текста. Пользователь просит внести точечные изменения в СОДЕРЖАНИЕ или ГРУППИРОВКУ сущностей, не переделывая всё заново.

ПОЖЕЛАНИЯ ПОЛЬЗОВАТЕЛЯ (приоритет):
${userInstructions || "(не указано)"}

ДОПУСТИМЫЕ ТИПЫ СУЩНОСТЕЙ (entityType):
${ENTITY_TYPES_LIST}

ТЕКУЩИЙ JSON АНАЛИЗА:
${currentAnalysisJson || "(нет)"}

ТЕКУЩИЙ ТЕКСТ САММАРИ (для контекста):
${currentContentText || "(нет)"}

Задача:
- Внеси в существующий JSON минимальные изменения, которые отражают пожелания пользователя (добавь/удали/переформулируй сущности, переназначь sectionId для перегруппировки, поменяй priority, скорректируй title/content/formula/example/visual).
- Не переделывай поля, которые пользователь не просил менять.
- Сохрани все требования формата: те же поля, тот же набор entityType, sourceMode, topic, subject, grade, summary, entities[], warnings[].
- ${strict ? "Формулы оформляй в LaTeX ($...$ или $$...$$) для сложных и юникодом (x², a₁, √) для простых. Никаких командных символов (\\) вне LaTeX-обрамления." : "Формулы оформляй как в исходном JSON."}
- ЭКРАНИРОВАНИЕ ОБРАТНЫХ СЛЕШЕЙ В JSON (критично): любой \\ внутри строки удваивай — пиши \\\\frac, \\\\sqrt, \\\\Delta. Иначе JSON сломается.
- Если не можешь гарантировать валидный JSON с LaTeX-командой, перепиши формулу в безопасной юникодной записи без обратных слешей.
- Никогда не вставляй в JSON-строки сырые переводы строк: используй одну строку или escape-последовательность \\n.

Верни СТРОГО один JSON-объект новой версии анализа, без markdown-ограждений, без комментариев. Никакого текста вне JSON.`;
}

export function buildRefineBriefPrompt(opts: {
  userInstructions: string;
  currentBriefJson: string;
}): string {
  const { userInstructions, currentBriefJson } = opts;
  return `Ты — арт-директор инфографик. Тебе уже передан готовый дизайн-бриф (PromptForImageGeneration + WireframeDescription). Пользователь просит изменить только РАЗМЕЩЕНИЕ блоков — перетасовать, поменять размеры, поменять порядок рядов, объединить или разделить ряды. Текстовое содержание карточек, цветовая палитра, типографика и стилистика остаются ровно такими же.

ПОЖЕЛАНИЯ ПОЛЬЗОВАТЕЛЯ (приоритет):
${userInstructions || "(не указано)"}

ТЕКУЩИЙ ДИЗАЙН-БРИФ (JSON):
${currentBriefJson}

Правила:
- Не меняй цвета, шрифты, mood, общий стиль — оставь BRAND DNA и COMPOSITION GRAMMAR как есть, кроме тех правил композиции, которые прямо противоречат пожеланиям пользователя.
- Не меняй видимый учебный текст карточек (title, body, formula, example, visual.description) — он переносится из текущего брифа дословно.
- Перестрой LAYER 3 (CONTENT LAYOUT) и WireframeDescription так, чтобы расположение блоков было максимально близко к инструкции пользователя.
- Сохрани все карточки текущего брифа — ни одна не должна исчезнуть, новых не добавляй.
- Wireframe должен быть один-в-один с новым LAYER 3: тот же порядок рядов и блоков, тот же набор id, sectionId, entityType, role, title; contentPreview — короткое смысловое саммари 4–10 слов о том, что внутри карточки.
- Внутри JSON-строки PromptForImageGeneration используй настоящие переводы строк \\n; четыре слоя (BRAND DNA, COMPOSITION GRAMMAR, CONTENT LAYOUT, TECHNICAL AND NEGATIVE INSTRUCTIONS) отделяй пустой строкой и заголовком; каждое поле каждой карточки — на отдельной строке.
- ЭКРАНИРОВАНИЕ ОБРАТНЫХ СЛЕШЕЙ: \\frac, \\sqrt и пр. внутри JSON-строк удваивай как \\\\frac, \\\\sqrt.

Верни СТРОГО один JSON-объект формы { "PromptForImageGeneration": "...", "WireframeDescription": { ... } }, без markdown-ограждений, без комментариев.`;
}

export function buildRefineImageDecisionPrompt(opts: {
  userInstructions: string;
  currentImagePrompt: string;
}): string {
  const { userInstructions, currentImagePrompt } = opts;
  return `Ты — арт-директор. У тебя есть готовый промпт для генерации финального изображения инфографики и просьба пользователя что-то в этом изображении изменить.

ПОЖЕЛАНИЯ ПОЛЬЗОВАТЕЛЯ:
${userInstructions}

ТЕКУЩИЙ ПРОМПТ ИЗОБРАЖЕНИЯ:
${currentImagePrompt}

Реши:
- Если изменение можно реализовать ПРАВКОЙ существующего промпта (например: перекрасить отдельный блок, сменить иконку, поменять акцентный цвет одной карточки, поменять фон, заменить декоративный элемент, чуть сместить акценты) — верни {"action":"patch","newPrompt":"<полностью обновлённый промпт целиком, со всеми четырьмя слоями BRAND DNA / COMPOSITION GRAMMAR / CONTENT LAYOUT / TECHNICAL AND NEGATIVE INSTRUCTIONS, с переводами строк \\n>"}. Сохрани структуру промпта и весь видимый учебный текст дословно.
- Если изменение требует ПЕРЕДЕЛКИ содержания или расположения блоков (добавить/убрать карточки, переставить ряды, перегруппировать сущности) — верни {"action":"rebuild","reason":"<короткое пояснение, почему правкой промпта не обойтись>"}. В этом случае инструмент вернётся на шаг дизайн-брифа.

Верни СТРОГО один JSON-объект, без markdown-ограждений, без комментариев. ЭКРАНИРОВАНИЕ обратных слешей в JSON-строках обязательно (\\\\frac вместо \\frac).`;
}
