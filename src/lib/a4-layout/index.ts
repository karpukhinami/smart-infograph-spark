import { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";
import { analyzeEntity } from "@/lib/a4-layout/estimate";
import { buildManualLayoutPlan, layoutPlanToManualRatiosText } from "@/lib/a4-layout/manual-layout";
import { optimizeRows } from "@/lib/a4-layout/optimize";
import { computeA4RowTargets } from "@/lib/a4-layout/row-targets";
import type { AnalysisJson, A4AutoLayoutResult, A4DomFitOptions, EntityHint, LayoutEntity } from "@/lib/a4-layout/types";
import { DEFAULT_A4_DOM_FIT_OPTIONS } from "@/lib/a4-layout/types";

function layoutAttention(att?: string | null): string {
  const a = String(att ?? "normal").toLowerCase();
  if (a === "main") return "core";
  if (a === "core" || a === "accent") return a;
  return "normal";
}

function prepareHints(analysis: AnalysisJson): {
  summary: A4AutoLayoutResult["summary"];
  hints: EntityHint[];
  settings: typeof DEFAULT_A4_SETTINGS;
} {
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
  return { summary, hints, settings };
}

export function buildA4AutoLayout(analysis: AnalysisJson): A4AutoLayoutResult {
  const { summary, hints, settings } = prepareHints(analysis);
  const plan = optimizeRows(hints, settings);
  const rowTargets = computeA4RowTargets(plan, settings, summary);
  return { summary, plan, settings, rowTargets, domFitOptions: DEFAULT_A4_DOM_FIT_OPTIONS };
}

export function buildA4ManualLayout(
  analysis: AnalysisJson,
  manualRatiosText: string,
  domFitOptions: A4DomFitOptions = DEFAULT_A4_DOM_FIT_OPTIONS,
): A4AutoLayoutResult {
  const { summary, hints, settings } = prepareHints(analysis);
  const trimmed = manualRatiosText.trim();
  let ratiosText = trimmed;
  let manualUsedAutoRatios = false;
  if (!ratiosText) {
    const autoPlan = optimizeRows(hints, settings);
    ratiosText = layoutPlanToManualRatiosText(autoPlan);
    manualUsedAutoRatios = true;
  }
  const { plan, errors } = buildManualLayoutPlan(hints, settings, ratiosText, domFitOptions);
  const rowTargets = computeA4RowTargets(plan, settings, summary);
  return {
    summary,
    plan,
    settings,
    rowTargets,
    manualErrors: errors,
    domFitOptions,
    manualUsedAutoRatios,
  };
}

export * from "@/lib/a4-layout/types";
export { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";
export { runA4DomFit, checkA4Overflow, applyA4HeaderFonts, captureA4FitStyles, restoreA4FitStyles, A4_DOM_FIT_SCREEN_OPTIONS, A4_DOM_FIT_EXPORT_OPTIONS } from "@/lib/a4-layout/dom-fit";
export { renderA4CardInner, renderA4CardClassName, renderA4HeaderHtml } from "@/lib/a4-layout/render";
export { parseManualRatios, layoutPlanToManualRatiosText, fractionsToRatioLine } from "@/lib/a4-layout/manual-layout";
export { buildAIInputJSON } from "@/lib/a4-layout/ai-input";
export { AI_LAYOUT_PROMPT } from "@/lib/a4-layout/ai-prompt";
export { normalizeAIResponse, type AILayoutResult } from "@/lib/a4-layout/ai-response";
export { buildA4AILayout } from "@/lib/a4-layout/ai-plan";
export { buildA4ProfileThemeStyle, a4CardSurfaceClass, mixHex } from "@/lib/a4-layout/profile-theme";
export {
  exportA4LayoutPng,
  A4_LAYOUT_EXPORT_WIDTH,
  A4_LAYOUT_EXPORT_HEIGHT,
  a4LayoutExportPixelRatio,
} from "@/lib/a4-layout/export-png";
