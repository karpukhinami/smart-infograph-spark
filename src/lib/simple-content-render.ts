import type { AnalysisEntity, AnalysisGroupItem, AnalysisJson, AnalysisSectionId } from "./types";

const SECTION_LABELS: Record<AnalysisSectionId, string> = {
  prerequisites: "Введение",
  main: "Основная часть",
  additions: "Дополнения и уточнения",
};

const SECTION_ORDER: AnalysisSectionId[] = ["prerequisites", "main", "additions"];

function asLines(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v)
    ? v.filter((s) => s != null && String(s).trim() !== "").map(String)
    : [String(v)];
}

export interface SimpleRenderBlock {
  title?: string | null;
  content: string[];
  formula: string[];
  addendum: string[];
  items?: SimpleRenderBlock[];
}

export interface SimpleRenderSection {
  sectionLabel: string;
  blocks: SimpleRenderBlock[];
}

function renderItem(it: AnalysisGroupItem): SimpleRenderBlock {
  return {
    title: it.title ?? null,
    content: asLines(it.content),
    formula: asLines(it.formula),
    addendum: asLines(it.cardAddendum),
  };
}

function renderEntity(e: AnalysisEntity): SimpleRenderBlock {
  return {
    title: e.title ?? null,
    content: asLines(e.content),
    formula: asLines(e.formula),
    addendum: asLines(e.cardAddendum),
    items: Array.isArray(e.items) && e.items.length ? e.items.map(renderItem) : undefined,
  };
}

export function renderSimpleSummary(a: AnalysisJson): SimpleRenderSection[] {
  const bySection = new Map<string, AnalysisEntity[]>();
  for (const e of a.entities ?? []) {
    const sid = String(e.sectionId ?? "");
    const list = bySection.get(sid) ?? [];
    list.push(e);
    bySection.set(sid, list);
  }
  const order: string[] = [];
  for (const sid of SECTION_ORDER) if (bySection.has(sid)) order.push(sid);
  for (const k of bySection.keys()) if (!order.includes(k)) order.push(k);

  return order.map((sid) => ({
    sectionLabel: SECTION_LABELS[sid as AnalysisSectionId] ?? `Раздел ${sid}`,
    blocks: (bySection.get(sid) ?? []).map(renderEntity),
  }));
}
