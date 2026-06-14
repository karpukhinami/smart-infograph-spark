import type { ColumnRatio, RenderRow } from "./types";
import { COLUMN_RATIOS } from "./types";

export function parseColumnRatio(ratio: ColumnRatio): number[] {
  return ratio.split(":").map((s) => Number(s));
}

export function isValidColumnRatio(ratio: string): ratio is ColumnRatio {
  return (COLUMN_RATIOS as readonly string[]).includes(ratio);
}

export interface RowGeometry {
  y: number;
  height: number;
}

export function computeRowGeometries(
  rows: RenderRow[],
  canvasHeight: number,
  marginPx: number,
  gapPx: number,
): RowGeometry[] {
  const rowCount = rows.length;
  const available =
    canvasHeight - 2 * marginPx - gapPx * Math.max(0, rowCount - 1);
  const sumW = rows.reduce((a, r) => a + r.heightWeight, 0) || 1;
  const out: RowGeometry[] = [];
  let cursor = marginPx;
  rows.forEach((r) => {
    const h = (available * r.heightWeight) / sumW;
    out.push({ y: cursor, height: h });
    cursor += h + gapPx;
  });
  return out;
}

export function computeCardWidths(
  ratio: ColumnRatio,
  canvasWidth: number,
  marginPx: number,
  gapPx: number,
): number[] {
  const parts = parseColumnRatio(ratio);
  const cardCount = parts.length;
  const available = canvasWidth - 2 * marginPx;
  const inner = available - gapPx * Math.max(0, cardCount - 1);
  const sum = parts.reduce((a, b) => a + b, 0) || 1;
  return parts.map((p) => (inner * p) / sum);
}
