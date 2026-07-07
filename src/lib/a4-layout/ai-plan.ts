import { analyzeEntity } from "@/lib/a4-layout/estimate";
import { computeA4RowTargets } from "@/lib/a4-layout/row-targets";
import { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";
import { sanitizeAIHtml } from "@/lib/a4-layout/sanitize-ai-html";
import { normalizeAIRowsForRender, type AILayoutResult } from "@/lib/a4-layout/ai-response";
import type {
  A4AutoLayoutResult,
  A4DomFitOptions,
  AiAddendumsSpec,
  EntityHint,
  LayoutEntity,
  LayoutPlan,
  WidthReport,
} from "@/lib/a4-layout/types";
import { DEFAULT_A4_DOM_FIT_OPTIONS } from "@/lib/a4-layout/types";
import { asArray, flattenText } from "@/lib/a4-layout/text";
import type { AnalysisJson } from "@/lib/types";

function normalizedAIAddendums(addendums: AILayoutResult["cards"][0]["addendums"]): AiAddendumsSpec {
  const raw = addendums || {};
  let items: unknown[] = [];
  if (Array.isArray(raw)) items = raw;
  else if (Array.isArray(raw.items)) items = raw.items;
  else if (raw.items != null) items = [raw.items];

  const placement = raw.placement === "right" ? "right" : "below";
  let layout: AiAddendumsSpec["layout"] = ["single", "stack", "row", "grid"].includes(String(raw.layout))
    ? (raw.layout as AiAddendumsSpec["layout"])
    : "single";

  const normalizedItems = items.map((v) => flattenText(v)).filter(Boolean).slice(0, 4);
  if (normalizedItems.length <= 1) layout = "single";
  if (layout === "grid" && normalizedItems.length < 4) {
    layout = normalizedItems.length <= 2 ? "row" : "stack";
  }
  if (layout === "row" && normalizedItems.length > 3) layout = "grid";

  return { placement, layout, items: normalizedItems };
}

function aiCardsToEntities(result: AILayoutResult, allowAddendumRight: boolean): LayoutEntity[] {
  return (result.cards || []).map((card) => {
    const add = normalizedAIAddendums(card.addendums);
    const aiAddendums: AiAddendumsSpec = allowAddendumRight
      ? add
      : { ...add, placement: "below" };
    return {
      title: card.title || "",
      content: sanitizeAIHtml(card.content || ""),
      contentHtml: true,
      formula: null,
      cardAddendum: null,
      aiAddendums,
      attention: card.attention || "normal",
      entityType: "aiCard",
      sectionId: "main",
    };
  });
}

function makeAIReportForCard(hint: EntityHint, fraction: number, entity: LayoutEntity): WidthReport {
  const report = { ...hint.atFraction(fraction) };
  const add = entity.aiAddendums || { placement: "below", layout: "single", items: [] };
  if (add.placement === "right") {
    report.bestPlacement = "rightOfBody";
    if (report.heightRightPx == null) report.heightRightPx = report.heightBelowPx || report.bestHeightPx || 100;
    report.bestHeightPx = report.heightRightPx;
  } else {
    report.bestPlacement = "belowBody";
    report.bestHeightPx = report.heightBelowPx || report.bestHeightPx || 100;
  }
  return report;
}

function buildAILayoutPlan(
  result: AILayoutResult,
  settings = DEFAULT_A4_SETTINGS,
  domFitOptions: A4DomFitOptions = DEFAULT_A4_DOM_FIT_OPTIONS,
): LayoutPlan {
  const entities = aiCardsToEntities(result, domFitOptions.allowAddendumRight);
  const hints = entities.map((e, i) => analyzeEntity(e, i, settings));
  const rowsIn = normalizeAIRowsForRender(result.layout?.rows || [], entities.length);

  const rows = rowsIn.map((row) => {
    const cards = row.cards.map((c) => hints[c.cardId - 1]);
    const reports = row.cards.map((c) => {
      const entity = entities[c.cardId - 1];
      const hint = hints[c.cardId - 1];
      return makeAIReportForCard(hint, c.fraction, entity);
    });
    const heights = reports.map((r) => Math.max(34, r.bestHeightPx || r.heightBelowPx || 100));
    return {
      cards,
      fractions: row.cards.map((c) => c.fraction),
      reports,
      heights,
      rowHeight: Math.max(...heights),
      cost: Math.max(...heights),
      pattern: row.cards.map((c) => String(c.fraction)).join(":"),
      emptyPx: 0,
      emptyRatio: 0,
      mixedSections: false,
    };
  });

  const availableHeight = settings.pageHeightPx - 2 * settings.outerMarginPx;
  const totalRowsHeight =
    rows.reduce((sum, r) => sum + r.rowHeight, 0) + Math.max(0, rows.length - 1) * settings.gapPx;

  return {
    orderedEntityIndexes: entities.map((_, i) => i),
    rows,
    score: rows.reduce((sum, r) => sum + (r.cost || r.rowHeight), 0),
    totalRowsHeight: Math.round(totalRowsHeight),
    availableHeight: Math.round(availableHeight),
    fitRatio: Math.round((totalRowsHeight / Math.max(1, availableHeight)) * 100),
    verdict: totalRowsHeight <= availableHeight ? "aiLayout" : "aiOverflowRisk",
    alternatives: [],
    decisions: [],
    trace: [],
  };
}

/** Turn parsed AI response into a full A4 layout result for rendering. */
export function buildA4AILayout(
  analysis: AnalysisJson,
  aiResult: AILayoutResult,
  domFitOptions: A4DomFitOptions = DEFAULT_A4_DOM_FIT_OPTIONS,
): A4AutoLayoutResult {
  const settings = { ...DEFAULT_A4_SETTINGS };
  const summary = {
    topic: analysis.topic,
    summary: analysis.summary,
    subject: analysis.subject,
    grade: analysis.grade,
  };
  const plan = buildAILayoutPlan(aiResult, settings, domFitOptions);
  const rowTargets = computeA4RowTargets(plan, settings, summary);
  return { summary, plan, settings, rowTargets, domFitOptions };
}
