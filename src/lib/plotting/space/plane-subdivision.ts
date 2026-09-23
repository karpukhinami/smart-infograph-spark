import { clipLineToConvexPolygon, computeFaceOrPlaneSection, type ResolvedSpaceScene } from "./build";
import { worldViewSortDepth } from "./camera";
import type { SpaceFigure, SpaceSceneData, Vec3 } from "./types";
import {
  add,
  cross,
  dot,
  intersectPlanes,
  len,
  normalize,
  scale,
  sub,
  type PlaneEq,
} from "./vec3";

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

interface Point2D {
  x: number;
  y: number;
}

function planeBasis2D(polygon: Vec3[], normal: Vec3): { origin: Vec3; e1: Vec3; e2: Vec3 } {
  const origin = polygon[0]!;
  let e1 = sub(polygon[1]!, origin);
  if (len(e1) < 1e-9) e1 = sub(polygon[2] ?? polygon[1]!, origin);
  e1 = normalize(e1);
  const e2 = normalize(cross(normal, e1));
  return { origin, e1, e2 };
}

function to2D(p: Vec3, origin: Vec3, e1: Vec3, e2: Vec3): Point2D {
  const d = sub(p, origin);
  return { x: dot(d, e1), y: dot(d, e2) };
}

function from2D(p: Point2D, origin: Vec3, e1: Vec3, e2: Vec3): Vec3 {
  return add(add(origin, scale(e1, p.x)), scale(e2, p.y));
}

function sideOfLine(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

function segmentLineIntersection2D(
  p1: Point2D,
  p2: Point2D,
  lx0: number,
  ly0: number,
  lx1: number,
  ly1: number,
): Point2D | null {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  const den = (x1 - x2) * (ly0 - ly1) - (y1 - y2) * (lx0 - lx1);
  if (Math.abs(den) < 1e-12) return null;
  const t = ((x1 - lx0) * (ly0 - ly1) - (y1 - ly0) * (lx0 - lx1)) / den;
  if (t < -1e-8 || t > 1 + 1e-8) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

/** Разрез выпуклого 2D- многоугольника прямой (бесконечной). */
function splitConvexPolygonByLine2D(
  poly: Point2D[],
  lx0: number,
  ly0: number,
  lx1: number,
  ly1: number,
  eps = 1e-8,
): [Point2D[], Point2D[]] | null {
  const sides = poly.map((p) => sideOfLine(p.x, p.y, lx0, ly0, lx1, ly1));
  const hasPos = sides.some((s) => s > eps);
  const hasNeg = sides.some((s) => s < -eps);
  if (!hasPos || !hasNeg) return null;

  const positive: Point2D[] = [];
  const negative: Point2D[] = [];
  const n = poly.length;

  for (let i = 0; i < n; i += 1) {
    const cur = poly[i]!;
    const next = poly[(i + 1) % n]!;
    const sc = sides[i]!;
    const sn = sides[(i + 1) % n]!;

    if (sc >= -eps) positive.push(cur);
    if (sc <= eps) negative.push(cur);

    if (sc * sn < -eps * eps) {
      const hit = segmentLineIntersection2D(cur, next, lx0, ly0, lx1, ly1);
      if (hit) {
        positive.push(hit);
        negative.push(hit);
      }
    }
  }

  if (positive.length < 3 || negative.length < 3) return null;
  return [positive, negative];
}

function splitConvexPolygonByLine3D(
  polygon: Vec3[],
  lineOrigin: Vec3,
  lineDir: Vec3,
  planeNormal: Vec3,
): Vec3[][] {
  const { origin, e1, e2 } = planeBasis2D(polygon, planeNormal);
  const poly2d = polygon.map((p) => to2D(p, origin, e1, e2));
  const la = to2D(lineOrigin, origin, e1, e2);
  const lb = to2D(add(lineOrigin, lineDir), origin, e1, e2);
  const split = splitConvexPolygonByLine2D(poly2d, la.x, la.y, lb.x, lb.y);
  if (!split) return [polygon];
  return split.map((part) => part.map((p) => from2D(p, origin, e1, e2)));
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
    const line = intersectPlanes(planeEq, otherEq);
    if (!line) continue;
    const next: Vec3[][] = [];
    for (const frag of fragments) {
      if (frag.length < 3) continue;
      const clip = clipLineToConvexPolygon(line.origin, line.dir, frag);
      if (!clip) {
        next.push(frag);
        continue;
      }
      const pieces = splitConvexPolygonByLine3D(frag, line.origin, line.dir, planeEq.normal);
      next.push(...pieces);
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
