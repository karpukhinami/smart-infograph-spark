/** Нормализация JSON числовой прямой от модели перед importScene. */
import type { SceneLinePoint, SceneSet } from "./types";

type PartialLinePoint = Partial<SceneLinePoint> & {
  math?: Partial<SceneLinePoint["math"]>;
};

/** Граничные точки множеств модель не должна передавать — их создаёт buildLineScene. */
export function filterAiLinePoints(points: PartialLinePoint[] | undefined): PartialLinePoint[] {
  return (points ?? []).filter(
    (point) => !point.math?.sourceSetId && !point.math?.boundaryKey,
  );
}

/** Частая ошибка модели: axisRowCount: 2, axisRow: 1 при одной прямой. */
export function normalizeLineAxisRows<T extends {
  axisRowCount?: number;
  sets?: Partial<SceneSet>[];
  points?: PartialLinePoint[];
}>(line: T): T {
  const sets = line.sets ?? [];
  const rowCount = line.axisRowCount ?? 1;
  const usedRows = new Set(sets.map((s) => s.axisRow ?? 0));

  const shouldCollapse =
    rowCount > 1 && (usedRows.size <= 1 || (usedRows.has(1) && !usedRows.has(0)));

  if (shouldCollapse || rowCount === 1) {
    return {
      ...line,
      axisRowCount: 1,
      sets: sets.map((s) => ({ ...s, axisRow: 0 })),
      points: (line.points ?? []).map((p) => ({ ...p, axisRow: 0 })),
    };
  }

  return line;
}
