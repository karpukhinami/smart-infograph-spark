/**
 * Видимость рёбер по выпуклой оболочке 2D-проекции вершин (школьный контур «картинки»).
 */
import { projectFromLocalCoeffs } from "./camera";
import type { ResolvedSpaceScene } from "./build";
import { faceById, isPyramid } from "./figure";
import {
  buildPyramidObserver,
  isSegmentInsidePyramidVolume,
  isStrictlyInsidePyramidVolume,
  type PyramidObserver,
} from "./pyramid-view";
import type { LineSplitSegment, SpaceFigure, SpaceViewParams, Vec3 } from "./types";
import { add, len, planeFromPoints, planePointDistance, scale, sub } from "./vec3";
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
  /** Наблюдатель в декартовых координатах (пирамида). */
  pyramidObserver?: PyramidObserver;
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

  const pyramidObserver =
    isPyramid(body)
      ? buildPyramidObserver(body, resolved, resolved.projection, {
          hull,
          hullEdgeKeys,
          interiorVertexIds,
        })
      : undefined;

  return { hull, hullEdgeKeys, interiorVertexIds, pyramidObserver };
}

/**
 * Ребро сплошное, если ни одна вершина не внутри контура;
 * обе на контуре — сплошное (в т.ч. SA, SB, не только стороны оболочки).
 */
export function isBodyEdgeVisibleProjectionHull(
  aId: string,
  bId: string,
  hull: ProjectionHull,
): boolean {
  if (hull.interiorVertexIds.has(aId) || hull.interiorVertexIds.has(bId)) return false;
  return true;
}

/** Грань видима, если все её рёбра сплошные (нет инцидентной «внутренней» вершины). */
export function isFaceVisibleProjectionHull(
  faceId: string,
  figure: SpaceFigure,
  hull: ProjectionHull,
): boolean {
  const face = faceById(figure, faceId);
  if (!face) return true;
  for (const edge of figure.edges) {
    if (!face.vertexIds.includes(edge.aId) || !face.vertexIds.includes(edge.bId)) continue;
    if (!isBodyEdgeVisibleProjectionHull(edge.aId, edge.bId, hull)) return false;
  }
  return true;
}

export function matchFigureVertexAtWorld(
  world: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  eps = 2e-3,
): string | null {
  for (const v of figure.vertices) {
    const w = resolved.points.get(v.id)?.world;
    if (w && len(sub(w, world)) <= eps) return v.id;
  }
  return null;
}

function faceWorldPoints(faceId: string, figure: SpaceFigure, resolved: ResolvedSpaceScene): Vec3[] {
  const face = faceById(figure, faceId);
  if (!face) return [];
  return face.vertexIds.map((id) => resolved.points.get(id)?.world).filter(Boolean) as Vec3[];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function pointInFaceTriangle(p: Vec3, verts: Vec3[], eps = 1e-4): boolean {
  if (verts.length < 3) return false;
  const [v0, v1, v2] = verts;
  const plane = planeFromPoints(v0!, v1!, v2!);
  if (!plane || Math.abs(planePointDistance(p, plane)) > eps) return false;
  const n = cross3(sub(v1!, v0!), sub(v2!, v0!));
  let s = 0;
  for (let i = 0; i < 3; i += 1) {
    const a = verts[i]!;
    const b = verts[(i + 1) % 3]!;
    const cr = cross3(sub(b, a), sub(p, a));
    const d = cr.x * n.x + cr.y * n.y + cr.z * n.z;
    if (Math.abs(d) <= eps * eps) continue;
    if (s === 0) s = Math.sign(d);
    else if (Math.sign(d) !== s) return false;
  }
  return s !== 0;
}

function pointOnHiddenFace(
  p: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  hull: ProjectionHull,
): boolean {
  for (const face of figure.faces) {
    if (isFaceVisibleProjectionHull(face.id, figure, hull)) continue;
    const verts = faceWorldPoints(face.id, figure, resolved);
    if (pointInFaceTriangle(p, verts)) return true;
  }
  return false;
}

/** Видимость отрезка (плоскости, прямые): вершины контура + не лежит на «невидимой» грани. */
export function isWorldSegmentVisibleProjectionHull(
  aWorld: Vec3,
  bWorld: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  hull: ProjectionHull,
): boolean {
  const aId = matchFigureVertexAtWorld(aWorld, figure, resolved);
  const bId = matchFigureVertexAtWorld(bWorld, figure, resolved);
  if (aId && hull.interiorVertexIds.has(aId)) return false;
  if (bId && hull.interiorVertexIds.has(bId)) return false;
  if (aId && bId) return isBodyEdgeVisibleProjectionHull(aId, bId, hull);

  if (isSegmentInsidePyramidVolume(aWorld, bWorld, figure, resolved)) return false;

  const mid = scale(add(aWorld, bWorld), 0.5);
  if (pointOnHiddenFace(mid, figure, resolved, hull)) return false;
  return true;
}

export function splitLineProjectionHull(
  originWorld: Vec3,
  dirWorld: Vec3,
  t0: number,
  t1: number,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  hull: ProjectionHull,
): LineSplitSegment[] {
  const a = add(originWorld, scale(dirWorld, t0));
  const b = add(originWorld, scale(dirWorld, t1));
  const visible = isWorldSegmentVisibleProjectionHull(a, b, figure, resolved, hull);
  return [{ a, b, visible }];
}

/** Центр масс многоугольника — для фильтра заливки плоскости. */
export function polygonCentroid(vertices: Vec3[]): Vec3 {
  if (!vertices.length) return { x: 0, y: 0, z: 0 };
  return scale(
    vertices.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }),
    1 / vertices.length,
  );
}

export function isPlaneFragmentVisibleProjectionHull(
  fragment: Vec3[],
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  hull: ProjectionHull,
): boolean {
  if (fragment.length < 3) return true;
  const c = polygonCentroid(fragment);
  if (isStrictlyInsidePyramidVolume(c, figure, resolved)) return false;
  return !pointOnHiddenFace(c, figure, resolved, hull);
}
