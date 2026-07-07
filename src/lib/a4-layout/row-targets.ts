import { estimateHeaderHeight } from "@/lib/a4-layout/estimate";
import type { A4LayoutSettings, A4LayoutSummary, A4RowTargets, LayoutPlan } from "@/lib/a4-layout/types";

export function computeA4RowTargets(plan: LayoutPlan, s: A4LayoutSettings, summary: A4LayoutSummary | null = null): A4RowTargets {
  const headerHeight = summary ? Math.round(estimateHeaderHeight(summary, s)) : 0;
  const headerGap = headerHeight > 0 ? s.gapPx : 0;
  const availableRowsHeight = Math.max(40, s.pageHeightPx - 2 * s.outerMarginPx - headerHeight - headerGap);
  const rows = plan.rows || [];
  const estimated = rows.map((r) => Math.max(34, Number(r.rowHeight || 80)));
  const sumRows = estimated.reduce((a, b) => a + b, 0);
  const baseGap = s.gapPx;
  const baseGapTotal = baseGap * Math.max(0, rows.length - 1);
  let rowScale: number;
  let rowGap: number;

  if (sumRows + baseGapTotal <= availableRowsHeight) {
    rowGap = baseGap;
    rowScale = (availableRowsHeight - baseGapTotal) / Math.max(1, sumRows);
  } else {
    const scale = availableRowsHeight / Math.max(1, sumRows + baseGapTotal);
    rowScale = scale;
    rowGap = baseGap * scale;
  }

  return {
    headerHeight,
    headerGap,
    availableRowsHeight,
    estimated,
    rowScale,
    rowGap,
    targetHeights: estimated.map((h) => Math.max(34, h * rowScale)),
  };
}
