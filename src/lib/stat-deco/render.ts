/** Human-readable Markdown rendering of the stat-deco JSON (Контент). */
import type { StatDecoJson } from "@/lib/types";
import { formatNum } from "./data";

export const CHART_TYPE_LABELS: Record<StatDecoJson["chartType"], string> = {
  bar: "Столбчатая диаграмма",
  line: "Линейная диаграмма",
  area: "Диаграмма с областями",
  pie: "Круговая диаграмма",
  scatter: "Диаграмма рассеяния",
  histogram: "Гистограмма распределения",
  radar: "Лепестковая диаграмма",
  funnel: "Воронка",
  treemap: "Плиточная диаграмма (treemap)",
  waterfall: "Каскадная диаграмма",
  boxplot: "Ящик с усами",
};

function cell(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return typeof v === "number" ? formatNum(v) : String(v);
}

/** Column-oriented data → Markdown table (rows = observations). */
export function statDecoTableMarkdown(json: StatDecoJson): string {
  const cols = json.data.columns;
  if (!cols.length) return "_Данных нет._";
  const rowCount = Math.max(...cols.map((c) => c.length - 1));
  const head = `| ${cols.map((c) => cell(c[0])).join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const rows: string[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    rows.push(`| ${cols.map((c) => cell(c[i + 1])).join(" | ")} |`);
  }
  return [head, sep, ...rows].join("\n");
}

export function renderStatDecoJson(json: StatDecoJson): string {
  const parts: string[] = [];
  parts.push(`# ${json.title || json.topic || "Диаграмма"}`);
  const meta = [json.subject, json.grade ? `${json.grade} класс` : null].filter(Boolean).join(" · ");
  if (meta) parts.push(`_${meta}_`);
  parts.push(`**Тип диаграммы:** ${CHART_TYPE_LABELS[json.chartType]}`);
  if (json.summary) parts.push(json.summary);
  if (!json.dataStatus.canRender) {
    parts.push(`> **Диаграмма не может быть построена.** ${json.dataStatus.reason || ""}`.trim());
  }
  parts.push("## Данные");
  parts.push(statDecoTableMarkdown(json));

  const plan = json.illustrationPlan;
  if (plan.visualIntent || plan.overallTreatment || plan.elementInstructions.length) {
    parts.push("## Идеи оформления");
    if (plan.visualIntent) parts.push(`**Замысел:** ${plan.visualIntent}`);
    if (plan.overallTreatment) parts.push(`**Общая обработка:** ${plan.overallTreatment}`);
    plan.elementInstructions.forEach((e) => {
      parts.push(`- **${e.target || "элемент"}:** ${e.instruction}`);
    });
  }
  if (json.warnings.length) {
    parts.push("## Замечания");
    json.warnings.forEach((w) => parts.push(`- ${w}`));
  }
  return parts.join("\n\n");
}
