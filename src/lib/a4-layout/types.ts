import type { AnalysisEntity, AnalysisJson } from "@/lib/types";

export interface A4LayoutSettings {
  pageWidthPx: number;
  pageHeightPx: number;
  outerMarginPx: number;
  gapPx: number;
  paddingXPx: number;
  paddingYPx: number;
  bodyPx: number;
  bodyLinePx: number;
  titlePillPx: number;
  insetPaddingYPx: number;
  avgCharEm: number;
  safety: number;
  optimizerMode: "balanced" | "compact" | "airy";
}

export interface AiAddendumsSpec {
  placement: "below" | "right";
  layout: "single" | "stack" | "row" | "grid";
  items: string[];
}

export type LayoutEntity = Omit<AnalysisEntity, "attention"> & {
  attention?: string;
  contentHtml?: boolean;
  aiAddendums?: AiAddendumsSpec | null;
};

export interface WidthReport {
  key: string;
  label: string;
  fraction: number;
  outerWidthPx: number;
  contentWidthPx: number;
  charsPerLine: number;
  titleLines: number;
  bodyLines: number;
  formulaLines: number;
  addendumBelowLines: number;
  heightBelowPx: number;
  heightRightPx: number | null;
  rightGainPercent: number | null;
  rightStatus: string;
  bestPlacement: string;
  bestHeightPx: number;
  fit: "good" | "risky" | "bad";
}

export interface EntityHint {
  entityIndex: number;
  title: string;
  sectionId: string;
  entityType: string;
  attention: string;
  sourceEntity: LayoutEntity;
  widthReports: WidthReport[];
  atFraction: (fraction: number) => WidthReport;
  contentLoad: string;
  recommendedMinWidth: string;
  avoidWidths: string[];
  goodColumnRatios: string[];
  avoidColumnRatios: string[];
  addendumHint: Record<string, unknown>;
  formulaHint: Record<string, unknown>;
  hardConstraints: string[];
  softHints: string[];
}

export interface RowCostResult {
  pattern: string;
  fractions: number[];
  reports: WidthReport[];
  heights: number[];
  rowHeight: number;
  emptyPx: number;
  emptyRatio: number;
  mixedSections: boolean;
  cost: number;
}

export interface LayoutRow {
  cards: EntityHint[];
  pattern: string;
  fractions: number[];
  reports: WidthReport[];
  heights: number[];
  rowHeight: number;
  emptyPx: number;
  emptyRatio: number;
  mixedSections?: boolean;
  cost: number;
  decision?: string;
}

export interface LayoutPlan {
  orderedEntityIndexes: number[];
  rows: LayoutRow[];
  score: number;
  totalRowsHeight: number;
  availableHeight: number;
  fitRatio: number;
  verdict: string;
  alternatives: unknown[];
  decisions: unknown[];
  trace: unknown[];
  manual?: boolean;
  manualErrors?: string[];
}

export interface A4RowTargets {
  headerHeight: number;
  headerGap: number;
  availableRowsHeight: number;
  estimated: number[];
  rowScale: number;
  rowGap: number;
  targetHeights: number[];
}

export interface A4LayoutSummary {
  topic: string;
  summary: string;
  subject: string | null;
  grade: string | null;
}

export interface A4DomFitOptions {
  balanceRowFonts: boolean;
  allowAddendumRight: boolean;
  /** Max body/title font during grow; null = no practical cap (overflow stops growth). */
  maxBodyFont?: number | null;
  /** Distinguishes preview vs export fit pass in logs. */
  fitTarget?: "screen" | "export";
}

export const DEFAULT_A4_DOM_FIT_OPTIONS: A4DomFitOptions = {
  balanceRowFonts: true,
  allowAddendumRight: true,
  maxBodyFont: null,
  fitTarget: "screen",
};

export const A4_DOM_FIT_SCREEN_OPTIONS: A4DomFitOptions = {
  balanceRowFonts: true,
  allowAddendumRight: true,
  maxBodyFont: null,
  fitTarget: "screen",
};

export const A4_DOM_FIT_EXPORT_OPTIONS: A4DomFitOptions = {
  balanceRowFonts: true,
  allowAddendumRight: true,
  maxBodyFont: null,
  fitTarget: "export",
};

export interface A4RenderOptions {
  allowAddendumRight?: boolean;
}

export interface A4AutoLayoutResult {
  summary: A4LayoutSummary;
  plan: LayoutPlan;
  settings: A4LayoutSettings;
  rowTargets: A4RowTargets;
  manualErrors?: string[];
  domFitOptions?: A4DomFitOptions;
  manualUsedAutoRatios?: boolean;
}

export type { AnalysisJson };
