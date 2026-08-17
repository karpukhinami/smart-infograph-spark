/**
 * Validation + mechanical repair of the "стат-деко" JSON returned by the
 * analysis model. The JSON is an internal, stable application format — never an
 * ECharts config — so this module only normalizes it, never translates it.
 */
import type {
  StatDecoChartType,
  StatDecoColorMode,
  StatDecoColumn,
  StatDecoJson,
  StatDecoMapping,
  StatDecoRendering,
} from "@/lib/types";

export const STAT_DECO_STYLE_ID = "stat-deco";

const CHART_TYPES: StatDecoChartType[] = [
  "bar",
  "line",
  "area",
  "pie",
  "scatter",
  "histogram",
  "radar",
  "funnel",
  "treemap",
  "waterfall",
  "boxplot",
];

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = Array.isArray(v)
    ? v.filter((x) => x != null).map((x) => String(x).trim()).filter(Boolean).join("\n")
    : String(v);
  const t = s.trim();
  return t ? t : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/\s|\u00A0/g, "").replace(",", ".").replace(/%$/, "");
    if (cleaned && /^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  }
  return null;
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "yes" || t === "да") return true;
    if (t === "false" || t === "no" || t === "нет") return false;
  }
  return fallback;
}

function pick<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  const s = str(v)?.toLowerCase().replace(/[\s-]+/g, "");
  if (!s) return undefined;
  return allowed.find((a) => a.toLowerCase() === s);
}

function normalizeChartType(v: unknown, warnings: string[]): StatDecoChartType {
  const raw = str(v)?.toLowerCase() ?? "";
  const exact = CHART_TYPES.find((t) => t === raw);
  if (exact) return exact;
  if (raw.includes("donut") || raw.includes("doughnut") || raw.includes("круг")) return "pie";
  if (raw.includes("column") || raw.includes("столб")) return "bar";
  if (raw.includes("bubble")) return "scatter";
  const partial = CHART_TYPES.find((t) => raw.includes(t));
  if (partial) return partial;
  warnings.push(`Неизвестный chartType «${raw || "—"}», используем bar`);
  return "bar";
}

/**
 * Cells like «—», «-», «н/д» mean "no value" in source tables. In a numeric
 * column they are treated as zeros so the chart geometry stays continuous.
 */
const DASH_PLACEHOLDERS = new Set(["-", "–", "—", "―", "‒", "−", "н/д", "нд", "n/a", "na", "нет данных", "нет", "?"]);

function isDashPlaceholder(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return DASH_PLACEHOLDERS.has(v.trim().toLowerCase().replace(/\s+/g, " "));
}

/** Column-oriented data: first cell is the header, the rest are values. */
function normalizeColumns(raw: unknown, warnings: string[]): StatDecoColumn[] {
  const src = Array.isArray(raw) ? raw : [];
  const columns: StatDecoColumn[] = [];
  src.forEach((col, i) => {
    if (!Array.isArray(col)) {
      warnings.push(`Столбец ${i + 1} не является массивом — пропущен`);
      return;
    }
    const header = str(col[0]) ?? `Столбец ${i + 1}`;
    const body = col.slice(1);
    const hasNumbers = body.some((cell) => num(cell) !== null);
    const dashCount = body.filter((cell) => isDashPlaceholder(cell)).length;
    const values: StatDecoColumn = [header];
    for (let j = 0; j < body.length; j += 1) {
      const cell = body[j];
      const n = num(cell);
      if (n !== null) {
        values.push(n);
      } else if (hasNumbers && isDashPlaceholder(cell)) {
        values.push(0);
      } else {
        values.push(str(cell) ?? null);
      }
    }
    if (hasNumbers && dashCount > 0) {
      warnings.push(`Столбец «${header}»: прочерки (${dashCount}) заменены нулями`);
    }
    columns.push(values);
  });
  return columns;
}


function normalizeMapping(raw: unknown): StatDecoMapping {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: StatDecoMapping = {};
  (["label", "category", "value", "type", "parent", "x", "y", "size"] as const).forEach((k) => {
    const n = num(o[k]);
    if (n !== null && n >= 0) out[k] = Math.round(n);
  });
  return out;
}

function normalizeRendering(raw: unknown): StatDecoRendering {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const size = ["small", "medium", "large"] as const;
  const gap = ["narrow", "medium", "wide"] as const;
  return {
    orientation: pick(o.orientation, ["vertical", "horizontal"] as const),
    seriesLayout: pick(o.seriesLayout, ["grouped", "stacked", "stacked100", "overlay"] as const),
    barWidth: pick(o.barWidth, gap),
    categoryGap: pick(o.categoryGap ?? o.barGap, gap),
    seriesGap: pick(o.seriesGap, gap),
    volume: typeof o.volume === "undefined" ? undefined : bool(o.volume, false),
    headroom: pick(o.headroom, size),
    showValues: typeof o.showValues === "undefined" ? undefined : bool(o.showValues, true),
    colorMode: pick(o.colorMode, ["same", "similar", "different"] as const) as
      | StatDecoColorMode
      | undefined,
    chartSize: pick(o.chartSize, size),
    sliceGap: pick(o.sliceGap, ["none", "narrow", "medium", "wide"] as const),
    innerHole: pick(o.innerHole, ["none", "small", "medium", "large"] as const),
    lineWidth: pick(o.lineWidth, ["thin", "medium", "thick"] as const),
    lineShape: pick(o.lineShape, ["straight", "smooth"] as const),
    pointSize: pick(o.pointSize, ["none", "small", "medium", "large"] as const),
  };
}

export function validateStatDecoJson(raw: unknown): StatDecoJson {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Ответ модели не является объектом");
  }
  const o = raw as Record<string, unknown>;
  const warnings: string[] = Array.isArray(o.warnings)
    ? (o.warnings as unknown[]).map((w) => String(w))
    : [];

  const chartType = normalizeChartType(o.chartType, warnings);

  const dataRaw = (o.data && typeof o.data === "object" ? o.data : {}) as Record<string, unknown>;
  const columns = normalizeColumns(dataRaw.columns ?? o.columns, warnings);

  const statusRaw = (o.dataStatus && typeof o.dataStatus === "object" ? o.dataStatus : {}) as Record<
    string,
    unknown
  >;
  const reason = str(statusRaw.reason) ?? "";
  const declaredOk = typeof statusRaw.canRender === "undefined" ? true : bool(statusRaw.canRender, true);

  const planRaw = (o.illustrationPlan && typeof o.illustrationPlan === "object"
    ? o.illustrationPlan
    : {}) as Record<string, unknown>;
  const instrRaw = Array.isArray(planRaw.elementInstructions) ? planRaw.elementInstructions : [];

  const hasData = columns.length > 0 && columns.some((c) => c.length > 1);
  if (declaredOk && !hasData) {
    warnings.push("Модель отметила canRender=true, но данных для диаграммы нет");
  }

  return {
    kind: "stat-deco",
    sourceMode: "text",
    topic: str(o.topic) ?? "",
    subject: str(o.subject),
    grade: str(o.grade),
    chartType,
    title: str(o.title) ?? str(o.topic) ?? "Диаграмма",
    summary: str(o.summary) ?? "",
    dataStatus: { canRender: declaredOk && hasData, reason },
    data: { columns },
    mapping: normalizeMapping(o.mapping),
    rendering: normalizeRendering(o.rendering),
    illustrationPlan: {
      visualIntent: str(planRaw.visualIntent) ?? "",
      overallTreatment: str(planRaw.overallTreatment) ?? "",
      elementInstructions: instrRaw
        .map((it) => {
          const e = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          return { target: str(e.target) ?? "", instruction: str(e.instruction) ?? "" };
        })
        .filter((e) => e.target || e.instruction),
    },
    warnings,
  };
}
