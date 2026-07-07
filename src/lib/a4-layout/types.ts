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

export type LayoutEntity = AnalysisEntity & { attention?: string };

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

export interface A4AutoLayoutResult {
  summary: A4LayoutSummary;
  plan: LayoutPlan;
  settings: A4LayoutSettings;
  rowTargets: A4RowTargets;
}

export type { AnalysisJson };
