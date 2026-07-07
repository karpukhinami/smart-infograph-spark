import { analyzeEntity } from "@/lib/a4-layout/estimate";
import { optimizeRows } from "@/lib/a4-layout/optimize";
import { DEFAULT_A4_SETTINGS } from "@/lib/a4-layout/settings";
import { entityContentToInputHtml } from "@/lib/a4-layout/content-html";
import { asArray, flattenText } from "@/lib/a4-layout/text";
import type { AnalysisJson } from "@/lib/types";
import type { EntityHint, LayoutEntity } from "@/lib/a4-layout/types";

function layoutAttention(att?: string | null): string {
  const a = String(att ?? "normal").toLowerCase();
  if (a === "main") return "core";
  if (a === "core" || a === "accent") return a;
  return "normal";
}

function buildMechanicalAutoLayout(analysis: AnalysisJson) {
  const settings = { ...DEFAULT_A4_SETTINGS };
  const entities: LayoutEntity[] = (analysis.entities ?? []).map((entity) => ({
    ...entity,
    attention: layoutAttention(entity.attention),
  }));
  const hints: EntityHint[] = entities.map((entity, index) => analyzeEntity(entity, index, settings));
  const plan = optimizeRows(hints, settings);
  const summary = {
    topic: analysis.topic,
    summary: analysis.summary,
    subject: analysis.subject,
    grade: analysis.grade,
  };
  return { plan, summary };
}

export interface AIInputCard {
  cardId: number;
  title: string;
  content: string;
  addendums: { placement: "below" | "right"; items: string[] };
  attention: string;
  sizeEstimates: Record<string, number>;
}

export interface AIInputJSON {
  topic: string;
  summary: string;
  cards: AIInputCard[];
  currentLayout: {
    rows: Array<{ cards: Array<{ cardId: number; width: string }> }>;
  };
}

/** Build model input from analysis using the mechanical auto-layout (never manual). */
export function buildAIInputJSON(analysis: AnalysisJson): AIInputJSON {
  const { plan, summary } = buildMechanicalAutoLayout(analysis);

  const placementByCard: Record<number, "below" | "right"> = {};
  plan.rows.forEach((row) => {
    row.cards.forEach((card, i) => {
      placementByCard[card.entityIndex] =
        row.reports[i]?.bestPlacement === "rightOfBody" ? "right" : "below";
    });
  });

  const cards: AIInputCard[] = plan.rows
    .flatMap((row) => row.cards)
    .sort((a, b) => a.entityIndex - b.entityIndex)
    .map((hint) => {
      const entity = hint.sourceEntity;
      const addendums = [
        ...asArray(entity.formula).map((v) => flattenText(v)),
        ...asArray(entity.cardAddendum).map((v) => flattenText(v)),
      ].filter(Boolean);
      const sizes: Record<string, number> = {};
      hint.widthReports.forEach((r) => {
        sizes[r.label] = r.heightBelowPx;
      });
      return {
        cardId: hint.entityIndex + 1,
        title: entity.title || hint.title || "",
        content: entityContentToInputHtml(entity.content, entity.entityType === "actionList"),
        addendums: {
          placement: placementByCard[hint.entityIndex] || "below",
          items: addendums,
        },
        attention: entity.attention || "normal",
        sizeEstimates: sizes,
      };
    });

  return {
    topic: summary.topic || "",
    summary: summary.summary || "",
    cards,
    currentLayout: {
      rows: plan.rows.map((row) => ({
        cards: row.cards.map((card, i) => ({
          cardId: card.entityIndex + 1,
          width: `${Math.round(row.fractions[i] * 100)}%`,
        })),
      })),
    },
  };
}
