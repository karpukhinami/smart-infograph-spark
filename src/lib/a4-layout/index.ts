import { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";
import { analyzeEntity } from "@/lib/a4-layout/estimate";
import { optimizeRows } from "@/lib/a4-layout/optimize";
import { computeA4RowTargets } from "@/lib/a4-layout/row-targets";
import type { AnalysisJson, A4AutoLayoutResult, LayoutEntity } from "@/lib/a4-layout/types";

function layoutAttention(att?: string | null): string {
  const a = String(att ?? "normal").toLowerCase();
  if (a === "main") return "core";
  if (a === "core" || a === "accent") return a;
  return "normal";
}

export function buildA4AutoLayout(analysis: AnalysisJson): A4AutoLayoutResult {
  const settings = { ...DEFAULT_A4_SETTINGS };
  const entities: LayoutEntity[] = (analysis.entities ?? []).map((entity) => ({
    ...entity,
    attention: layoutAttention(entity.attention),
  }));

  const summary = {
    topic: analysis.topic,
    summary: analysis.summary,
    subject: analysis.subject,
    grade: analysis.grade,
  };

  const hints = entities.map((entity, index) => analyzeEntity(entity, index, settings));
  const plan = optimizeRows(hints, settings);
  const rowTargets = computeA4RowTargets(plan, settings, summary);

  return { summary, plan, settings, rowTargets };
}

export * from "@/lib/a4-layout/types";
export { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";
export { runA4DomFit, checkA4Overflow } from "@/lib/a4-layout/dom-fit";
export { renderA4CardInner, renderA4CardClassName, renderA4HeaderHtml } from "@/lib/a4-layout/render";
