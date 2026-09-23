import { computeFaceOrPlaneSection, type ResolvedSpaceScene } from "./build";
import { worldViewSortDepth } from "./camera";
import type { SpaceFigure, SpaceSceneData, Vec3 } from "./types";
import { add, dot, len, planePointDistance, scale, sub, type PlaneEq } from "./vec3";

export interface PlaneFillFragment {
  planeId: string;
  color: string;
  vertices: Vec3[];
  /** Средняя глубина проекции: меньше — ближе к наблюдателю. */
  depth: number;
  /**
   * Исходное (неразбитое) сечение плоскости — по нему определяется, какие
   * рёбра фрагмента являются настоящей границей плоскости, а какие —
   * технические «разрезы», появившиеся при делении на фрагменты для
   * подсчёта глубины (их не нужно рисовать как линии).
   */
  originalSection: Vec3[];
}

/**
 * Делит выпуклое сечение плоскости A на части по полупространствам плоскости B.
 * Граница — линия пересечения A∩B (без 2D-проекции и без clipLineToConvexPolygon).
 */
function splitConvexPolygonByHalfSpace(
  polygon: Vec3[],
  cuttingPlane: PlaneEq,
  eps = 1e-7,
): Vec3[][] {
  const dists = polygon.map((p) => planePointDistance(p, cuttingPlane));
  const hasPos = dists.some((d) => d > eps);
  const hasNeg = dists.some((d) => d < -eps);
  if (!hasPos || !hasNeg) return [polygon];

  const pos: Vec3[] = [];
  const neg: Vec3[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i += 1) {
    const cur = polygon[i]!;
    const next = polygon[(i + 1) % n]!;
    const dc = dists[i]!;
    const dn = dists[(i + 1) % n]!;

    if (dc >= -eps) pos.push(cur);
    if (dc <= eps) neg.push(cur);

    if (dc * dn < -eps * eps) {
      const t = dc / (dc - dn);
      const hit = add(cur, scale(sub(next, cur), t));
      pos.push(hit);
      neg.push(hit);
    }
  }

  const out: Vec3[][] = [];
  if (pos.length >= 3) out.push(pos);
  if (neg.length >= 3) out.push(neg);
  return out.length ? out : [polygon];
}

/**
 * Проверяет, лежит ли отрезок [a,b] на одном из рёбер исходного многоугольника
 * `section` (в пределах его длины). Используется, чтобы отличить настоящие
 * границы сечения плоскости от «разрезов», добавленных при делении фрагмента
 * линией пересечения с другой плоскостью — такие разрезы не являются частью
 * контура плоскости и не должны отображаться как линия.
 */
export function isSegmentOnPolygonBoundary(
  a: Vec3,
  b: Vec3,
  section: Vec3[],
  eps = 1e-4,
): boolean {
  const n = section.length;
  for (let i = 0; i < n; i += 1) {
    const p0 = section[i]!;
    const p1 = section[(i + 1) % n]!;
    const full = sub(p1, p0);
    const edgeLen = len(full);
    if (edgeLen < 1e-9) continue;
    const dir = scale(full, 1 / edgeLen);

    const da = sub(a, p0);
    const db = sub(b, p0);
    const ta = dot(da, dir);
    const tb = dot(db, dir);
    const perpA = sub(da, scale(dir, ta));
    const perpB = sub(db, scale(dir, tb));
    if (len(perpA) > eps || len(perpB) > eps) continue;

    const lo = Math.min(ta, tb);
    const hi = Math.max(ta, tb);
    if (lo >= -eps && hi <= edgeLen + eps) return true;
  }
  return false;
}

/** Делит сечение плоскости на части линиями пересечения с другими плоскостями. */
export function subdividePlaneSection(
  section: Vec3[],
  planeEq: PlaneEq,
  otherPlaneEqs: PlaneEq[],
): Vec3[][] {
  let fragments: Vec3[][] = [section];
  for (const otherEq of otherPlaneEqs) {
    const next: Vec3[][] = [];
    for (const frag of fragments) {
      if (frag.length < 3) continue;
      next.push(...splitConvexPolygonByHalfSpace(frag, otherEq));
    }
    fragments = next.length ? next : fragments;
  }
  return fragments;
}

/**
 * Средняя глубина фрагмента — та же `z`, что у `localToView` / `projectWorldDisplay`
 * (для пирамиды — `pyramidCartesianDepth`, для параллелепипеда — аффинная школьная
 * ось). Меньше значение — ближе к наблюдателю.
 */
function meanFragmentDepth(
  vertices: Vec3[],
  resolved: ResolvedSpaceScene,
  figure: SpaceFigure,
): number {
  let sum = 0;
  let count = 0;
  for (const world of vertices) {
    sum += worldViewSortDepth(world, resolved.basis, resolved.projection, figure);
    count += 1;
  }
  return count ? sum / count : 0;
}

/**
 * Фрагменты заливки всех плоскостей, отсортированные от дальних к ближним
 * (ближние рисуются последними).
 */
export function collectPlaneFillFragments(
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
): PlaneFillFragment[] {
  const builtPlanes = data.planes.filter((p) => p.built && p.style.visible);
  const fragments: PlaneFillFragment[] = [];

  for (const plane of builtPlanes) {
    const eq = resolved.planes.get(plane.id);
    if (!eq) continue;
    const section = computeFaceOrPlaneSection(
      plane.id,
      figure,
      resolved.points,
      resolved.planes,
      resolved.basis,
    );
    if (!section || section.length < 3) continue;

    const otherEqs = builtPlanes
      .filter((p) => p.id !== plane.id)
      .map((p) => resolved.planes.get(p.id))
      .filter(Boolean) as PlaneEq[];

    const parts =
      otherEqs.length > 0 ? subdividePlaneSection(section, eq, otherEqs) : [section];

    for (const part of parts) {
      if (part.length < 3) continue;
      fragments.push({
        planeId: plane.id,
        color: plane.style.color,
        vertices: part,
        depth: meanFragmentDepth(part, resolved, figure),
        originalSection: section,
      });
    }
  }

  fragments.sort((a, b) => b.depth - a.depth);
  return fragments;
}
