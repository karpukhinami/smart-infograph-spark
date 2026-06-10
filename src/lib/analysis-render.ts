import type { AnalysisEntity, AnalysisJson } from "./types";

const ENTITY_LABELS: Record<string, string> = {
  mainIdea: "Главная идея",
  definition: "Определение",
  rule: "Правило",
  principle: "Принцип",
  theorem: "Теорема",
  property: "Свойство",
  criterion: "Признак",
  consequence: "Следствие",
  formula: "Формула",
  example: "Пример",
  classification: "Классификация",
  comparison: "Сравнение",
  algorithm: "Алгоритм",
  solutionStep: "Шаг решения",
  taskCondition: "Условие задачи",
  given: "Дано",
  goal: "Найти",
  warning: "Внимание",
  commonMistake: "Частая ошибка",
  mnemonic: "Мнемоника",
  checklist: "Чеклист",
  visualCore: "Главный визуал",
  diagram: "Схема",
  conclusion: "Вывод",
  quote: "Цитата",
  etymology: "Этимология",
};

function asLines(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}

function renderEntity(e: AnalysisEntity): string {
  const label = ENTITY_LABELS[e.entityType] ?? e.entityType;
  const out: string[] = [];
  const heading = e.title ? `**${e.title}**` : "";
  out.push(`_${label}_${heading ? " · " + heading : ""}`);
  const content = asLines(e.content);
  if (content.length === 1) out.push(content[0]);
  else if (content.length > 1) out.push(content.map((c) => `• ${c}`).join("\n"));
  const formulas = asLines(e.formula);
  if (formulas.length) out.push(formulas.map((f) => "Формула: `" + f + "`").join("\n"));
  const examples = asLines(e.example);
  if (examples.length) out.push(examples.map((x) => "Пример: _" + x + "_").join("\n"));
  if (e.visual?.description) {
    out.push(`🖼 Иллюстрация (${e.visual.type || "схема"}): ${e.visual.description}`);
  }
  return out.join("\n");
}

export function renderAnalysisJson(a: AnalysisJson): string {
  const parts: string[] = [];
  parts.push(`# ${a.topic || "Без темы"}`);
  const meta = [a.subject, a.grade].filter(Boolean).join(" · ");
  if (meta) parts.push(`*${meta}*`);
  if (a.summary) parts.push(`> ${a.summary}`);

  const bySection = new Map<number, AnalysisEntity[]>();
  for (const e of a.entities ?? []) {
    const list = bySection.get(e.sectionId) ?? [];
    list.push(e);
    bySection.set(e.sectionId, list);
  }
  const sortedSections = [...bySection.keys()].sort((x, y) => x - y);
  for (const sid of sortedSections) {
    parts.push(`\n---\n\n### Раздел ${sid}`);
    for (const e of bySection.get(sid) ?? []) {
      parts.push(renderEntity(e));
    }
  }

  if (a.warnings?.length) {
    parts.push(`\n---\n\n### ⚠ Предупреждения анализа`);
    parts.push(a.warnings.map((w) => `- ${w}`).join("\n"));
  }
  return parts.join("\n\n");
}

/** Validate that the parsed object roughly matches AnalysisJson. */
export function validateAnalysisJson(raw: unknown): AnalysisJson {
  if (!raw || typeof raw !== "object") throw new Error("Ответ модели не является объектом");
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.entities)) throw new Error("В ответе отсутствует поле entities");
  if (typeof o.topic !== "string") throw new Error("В ответе отсутствует поле topic");
  const sourceMode = o.sourceMode === "topic" ? "topic" : "text";
  return {
    sourceMode,
    topic: o.topic,
    subject: (o.subject as string | null) ?? null,
    grade: (o.grade as string | null) ?? null,
    summary: typeof o.summary === "string" ? o.summary : "",
    entities: (o.entities as AnalysisEntity[]).map((e) => ({
      sectionId: Number(e.sectionId) || 1,
      entityType: String(e.entityType || "definition"),
      title: e.title ?? null,
      content: e.content ?? "",
      formula: e.formula ?? null,
      example: e.example ?? null,
      icon: e.icon ?? null,
      visual: e.visual ?? null,
      priority: e.priority ?? "medium",
    })),
    warnings: Array.isArray(o.warnings) ? (o.warnings as string[]) : [],
  };
}
