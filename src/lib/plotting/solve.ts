/**
 * Математический поиск точек: точка на графике и пересечения графиков.
 * Вычисления только числовые/аналитические, без LLM.
 */
import type { BuiltGraph } from "./types";

const EPSILON = 1e-9;

function dedupe(points: Array<{ x: number; y: number }>, tolerance: number) {
  const result: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    if (
      !result.some(
        (existing) =>
          Math.abs(existing.x - point.x) < tolerance && Math.abs(existing.y - point.y) < tolerance,
      )
    ) {
      result.push(point);
    }
  }
  return result.sort((a, b) => a.x - b.x || a.y - b.y);
}

/** Все точки графика с заданной горизонтальной координатой. */
export function pointsOnGraphAtX(
  built: BuiltGraph,
  x: number,
  tolerance = 1e-6,
): Array<{ x: number; y: number }> {
  const found: Array<{ x: number; y: number }> = [];
  for (const segment of built.segments) {
    for (let i = 0; i < segment.length - 1; i++) {
      const [x1, y1] = segment[i];
      const [x2, y2] = segment[i + 1];
      const min = Math.min(x1, x2);
      const max = Math.max(x1, x2);
      if (x < min - EPSILON || x > max + EPSILON) continue;
      if (Math.abs(x2 - x1) < EPSILON) {
        found.push({ x, y: (y1 + y2) / 2 });
        continue;
      }
      const t = (x - x1) / (x2 - x1);
      found.push({ x, y: y1 + (y2 - y1) * t });
    }
  }
  return dedupe(found, Math.max(tolerance, 1e-4));
}

function segmentIntersection(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): { x: number; y: number } | null {
  const rx = ax2 - ax1;
  const ry = ay2 - ay1;
  const sx = bx2 - bx1;
  const sy = by2 - by1;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-15) return null;
  const t = ((bx1 - ax1) * sy - (by1 - ay1) * sx) / denominator;
  const u = ((bx1 - ax1) * ry - (by1 - ay1) * rx) / denominator;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { x: ax1 + rx * t, y: ay1 + ry * t };
}

/** Пересечения двух построенных графиков. */
export function intersectGraphs(
  a: BuiltGraph,
  b: BuiltGraph,
  tolerance = 1e-3,
): Array<{ x: number; y: number }> {
  const found: Array<{ x: number; y: number }> = [];
  for (const first of a.segments) {
    for (let i = 0; i < first.length - 1; i++) {
      for (const second of b.segments) {
        for (let j = 0; j < second.length - 1; j++) {
          const hit = segmentIntersection(
            first[i][0], first[i][1], first[i + 1][0], first[i + 1][1],
            second[j][0], second[j][1], second[j + 1][0], second[j + 1][1],
          );
          if (hit) found.push(hit);
        }
      }
    }
  }
  return dedupe(found, tolerance);
}
