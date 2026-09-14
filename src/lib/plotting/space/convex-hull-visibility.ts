/**
 * Видимость рёбер по выпуклой оболочке 2D-проекции вершин (школьный контур «картинки»).
 */
import { projectFromLocalCoeffs } from "./camera";
import type { ResolvedSpaceScene } from "./build";
import type { SpaceFigure, SpaceViewParams } from "./types";
const COLLINEAR_EPS = 1e-9;

function edgeEndpointKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
}
const BOUNDARY_EPS = 1e-4;

export type ScreenVertex = { id: string; x: number; y: number };

/** Andrew's monotone chain — выпуклая оболочка (CCW, без дубликата последней). */
export function convexHull2D(points: ScreenVertex[]): ScreenVertex[] {
  if (points.length <= 1) return [...points];
  const sorted = [...points].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o: ScreenVertex, a: ScreenVertex, b: ScreenVertex) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: ScreenVertex[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= COLLINEAR_EPS
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: ScreenVertex[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= COLLINEAR_EPS
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function distPointToSegment2D(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-18) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

function pointStrictlyInsideConvexPoly(
  px: number,
  py: number,
  hull: Array<{ x: number; y: number }>,
): boolean {
  if (hull.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (Math.abs(cross) <= BOUNDARY_EPS) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  if (sign === 0) return false;
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    if (distPointToSegment2D(px, py, a.x, a.y, b.x, b.y) <= BOUNDARY_EPS) return false;
  }
  return true;
}

export type ProjectionHull = {
  hull: ScreenVertex[];
  hullEdgeKeys: Set<string>;
  /** Вершины строго внутри оболочки (не на границе). */
  interiorVertexIds: Set<string>;
};

export function buildProjectionConvexHull(
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): ProjectionHull {
  const body = resolved.figure ?? figure;
  const projected: ScreenVertex[] = [];
  for (const v of body.vertices) {
    const pt = resolved.points.get(v.id);
    if (!pt) continue;
    const pr = projectFromLocalCoeffs(pt.local, pt.world, view, resolved.projection, body);
    projected.push({ id: v.id, x: pr.x, y: pr.y });
  }

  const hull = convexHull2D(projected);
  const hullEdgeKeys = new Set<string>();
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    hullEdgeKeys.add(edgeEndpointKey(a.id, b.id));
  }

  const hullPoly = hull.map((p) => ({ x: p.x, y: p.y }));
  const hullCornerIds = new Set(hull.map((p) => p.id));
  const interiorVertexIds = new Set<string>();

  for (const p of projected) {
    if (hullCornerIds.has(p.id)) continue;
    let onBoundary = false;
    for (let i = 0; i < hull.length; i += 1) {
      const a = hull[i]!;
      const b = hull[(i + 1) % hull.length]!;
      if (distPointToSegment2D(p.x, p.y, a.x, a.y, b.x, b.y) <= BOUNDARY_EPS) {
        onBoundary = true;
        break;
      }
    }
    if (onBoundary) continue;
    if (pointStrictlyInsideConvexPoly(p.x, p.y, hullPoly)) interiorVertexIds.add(p.id);
  }

  return { hull, hullEdgeKeys, interiorVertexIds };
}

/** Ребро сплошное, если оно лежит на выпуклом контуре проекции; «внутренние» вершины — только пунктир. */
export function isBodyEdgeVisibleProjectionHull(
  aId: string,
  bId: string,
  hull: ProjectionHull,
): boolean {
  if (hull.interiorVertexIds.has(aId) || hull.interiorVertexIds.has(bId)) return false;
  return hull.hullEdgeKeys.has(edgeEndpointKey(aId, bId));
}
