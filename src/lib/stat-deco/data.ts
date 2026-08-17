/**
 * Column-oriented data helpers: turn the stable internal format into the
 * intermediate shapes the ECharts option builder consumes.
 */
import type { StatDecoColumn, StatDecoJson } from "@/lib/types";

export interface CategorySeries {
  categories: string[];
  series: Array<{ name: string; values: Array<number | null> }>;
}

export function header(col: StatDecoColumn | undefined): string {
  return col ? String(col[0] ?? "") : "";
}

export function bodyCells(col: StatDecoColumn | undefined): Array<string | number | null> {
  return col ? col.slice(1) : [];
}

export function numericBody(col: StatDecoColumn | undefined): Array<number | null> {
  return bodyCells(col).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
}

export function textBody(col: StatDecoColumn | undefined): string[] {
  return bodyCells(col).map((v) => (v == null ? "" : String(v)));
}

/** True when every non-empty body cell of a column is numeric. */
export function isNumericColumn(col: StatDecoColumn | undefined): boolean {
  const cells = bodyCells(col).filter((v) => v != null && v !== "");
  return cells.length > 0 && cells.every((v) => typeof v === "number");
}

/**
 * Positional convention: first column = categories, every following numeric
 * column = one data series. The number of series is never a separate parameter.
 */
export function toCategorySeries(json: StatDecoJson): CategorySeries {
  const cols = json.data.columns;
  if (!cols.length) return { categories: [], series: [] };
  const catIndex = json.mapping.category ?? json.mapping.label ?? 0;
  const categories = textBody(cols[catIndex]);
  const series = cols
    .map((col, i) => ({ col, i }))
    .filter(({ i, col }) => i !== catIndex && isNumericColumn(col))
    .map(({ col }) => ({ name: header(col), values: numericBody(col) }));
  return { categories, series };
}

/** First numeric column that is not the category column. */
export function firstNumericColumnIndex(json: StatDecoJson, skip: number[] = []): number {
  return json.data.columns.findIndex((col, i) => !skip.includes(i) && isNumericColumn(col));
}

/** Rows as tuples for scatter (+ optional size and label). */
export function toScatterPoints(json: StatDecoJson): {
  xName: string;
  yName: string;
  points: Array<{ x: number; y: number; size?: number; label: string }>;
} {
  const cols = json.data.columns;
  const labelIdx = json.mapping.label ?? (isNumericColumn(cols[0]) ? -1 : 0);
  const xIdx = json.mapping.x ?? cols.findIndex((c, i) => i !== labelIdx && isNumericColumn(c));
  const yIdx =
    json.mapping.y ?? cols.findIndex((c, i) => i !== labelIdx && i !== xIdx && isNumericColumn(c));
  const sizeIdx = json.mapping.size;
  const xs = numericBody(cols[xIdx]);
  const ys = numericBody(cols[yIdx]);
  const sizes = sizeIdx != null ? numericBody(cols[sizeIdx]) : [];
  const labels = labelIdx >= 0 ? textBody(cols[labelIdx]) : [];
  const points: Array<{ x: number; y: number; size?: number; label: string }> = [];
  for (let i = 0; i < Math.max(xs.length, ys.length); i += 1) {
    const x = xs[i];
    const y = ys[i];
    if (x == null || y == null) continue;
    points.push({ x, y, size: sizes[i] ?? undefined, label: labels[i] ?? "" });
  }
  return { xName: header(cols[xIdx]), yName: header(cols[yIdx]), points };
}

/** Histogram: raw observations live in one numeric column; bins computed here. */
export function histogramBins(values: number[]): { labels: string[]; counts: number[] } {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return { labels: [], counts: [] };
  const min = clean[0];
  const max = clean[clean.length - 1];
  if (min === max) return { labels: [formatNum(min)], counts: [clean.length] };
  // Sturges' rule, clamped to a readable range.
  const binCount = Math.max(3, Math.min(12, Math.ceil(Math.log2(clean.length) + 1)));
  const width = (max - min) / binCount;
  const counts = new Array(binCount).fill(0) as number[];
  clean.forEach((v) => {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
    counts[idx] += 1;
  });
  const labels = counts.map((_, i) => {
    const lo = min + i * width;
    const hi = i === binCount - 1 ? max : lo + width;
    return `${formatNum(lo)}–${formatNum(hi)}`;
  });
  return { labels, counts };
}

export interface BoxStats {
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
}

function quantile(sorted: number[], p: number): number {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Group raw observations by the label column and compute five-number summaries. */
export function toBoxplotStats(json: StatDecoJson): BoxStats[] {
  const cols = json.data.columns;
  const groupIdx = json.mapping.category ?? json.mapping.label ?? (isNumericColumn(cols[0]) ? -1 : 0);
  const valueIdx = json.mapping.value ?? firstNumericColumnIndex(json, groupIdx >= 0 ? [groupIdx] : []);
  const groups = groupIdx >= 0 ? textBody(cols[groupIdx]) : [];
  const values = numericBody(cols[valueIdx]);
  const buckets = new Map<string, number[]>();
  values.forEach((v, i) => {
    if (v == null) return;
    const key = groups[i] || header(cols[valueIdx]) || "Все данные";
    const arr = buckets.get(key) ?? [];
    arr.push(v);
    buckets.set(key, arr);
  });
  return Array.from(buckets.entries()).map(([name, raw]) => {
    const sorted = [...raw].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const median = quantile(sorted, 0.5);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const loFence = q1 - 1.5 * iqr;
    const hiFence = q3 + 1.5 * iqr;
    const inliers = sorted.filter((v) => v >= loFence && v <= hiFence);
    const outliers = sorted.filter((v) => v < loFence || v > hiFence);
    return {
      name,
      min: inliers.length ? inliers[0] : sorted[0],
      q1,
      median,
      q3,
      max: inliers.length ? inliers[inliers.length - 1] : sorted[sorted.length - 1],
      outliers,
    };
  });
}

export interface WaterfallStep {
  name: string;
  value: number;
  role: "increase" | "decrease" | "subtotal" | "total";
  base: number;
  span: number;
}

/** Cumulative layout for a waterfall, computed from the signed contributions. */
export function toWaterfallSteps(json: StatDecoJson): WaterfallStep[] {
  const cols = json.data.columns;
  const catIdx = json.mapping.category ?? 0;
  const valIdx = json.mapping.value ?? firstNumericColumnIndex(json, [catIdx]);
  const typeIdx = json.mapping.type;
  const names = textBody(cols[catIdx]);
  const values = numericBody(cols[valIdx]);
  const types = typeIdx != null ? textBody(cols[typeIdx]) : [];
  let running = 0;
  return names.map((name, i) => {
    const value = values[i] ?? 0;
    const declared = (types[i] ?? "").toLowerCase();
    const role: WaterfallStep["role"] =
      declared.includes("total") || declared.includes("итог")
        ? "total"
        : declared.includes("subtotal") || declared.includes("подытог")
          ? "subtotal"
          : declared.includes("decrease") || declared.includes("сниж") || value < 0
            ? "decrease"
            : "increase";
    if (role === "total" || role === "subtotal") {
      running = value;
      return { name, value, role, base: 0, span: Math.abs(value) };
    }
    const base = value >= 0 ? running : running + value;
    running += value;
    return { name, value, role, base, span: Math.abs(value) };
  });
}

export interface TreemapNode {
  name: string;
  value: number;
  children?: TreemapNode[];
}

/** Flat or nested treemap nodes (nesting via mapping.parent). */
export function toTreemapNodes(json: StatDecoJson): TreemapNode[] {
  const cols = json.data.columns;
  const catIdx = json.mapping.category ?? json.mapping.label ?? 0;
  const valIdx = json.mapping.value ?? firstNumericColumnIndex(json, [catIdx]);
  const parentIdx = json.mapping.parent;
  const names = textBody(cols[catIdx]);
  const values = numericBody(cols[valIdx]);
  const flat = names.map((name, i) => ({ name, value: values[i] ?? 0 }));
  if (parentIdx == null) return flat;
  const parents = textBody(cols[parentIdx]);
  const roots = new Map<string, TreemapNode>();
  flat.forEach((node, i) => {
    const parent = parents[i];
    if (!parent) {
      roots.set(node.name, roots.get(node.name) ?? { ...node, children: [] });
      return;
    }
    const bucket = roots.get(parent) ?? { name: parent, value: 0, children: [] };
    bucket.children = [...(bucket.children ?? []), node];
    roots.set(parent, bucket);
  });
  return Array.from(roots.values());
}

export function formatNum(v: number): string {
  if (!Number.isFinite(v)) return "";
  const rounded = Math.round(v * 100) / 100;
  return String(rounded).replace(".", ",");
}
