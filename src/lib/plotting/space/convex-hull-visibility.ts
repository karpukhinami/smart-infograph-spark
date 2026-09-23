/**
 * Видимость рёбер по выпуклой оболочке 2D-проекции вершин (школьный контур «картинки»).
 */
import { projectFromLocalCoeffs } from "./camera";
import type { ResolvedSpaceScene } from "./build";
import { locatePointOnFigureEdge } from "./display-projection";
import { faceById, isPyramid } from "./figure";
import type { PyramidFigure } from "./types";
import type { BuiltSpacePoint } from "./build";
import {
  buildPyramidObserver,
  isSegmentInsidePyramidVolume,
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
  /**
   * Если interior пуст: единственное пунктирное ребро тела (ребро основания
   * между крайней левой и крайней правой вершинами основания на чертеже).
   */
  soleDashedBodyEdgeKey: string | null;
  /** Наблюдатель в декартовых координатах (пирамида). */
  pyramidObserver?: PyramidObserver;
};

function isBaseVertexId(id: string): boolean {
  return id.startsWith("pyr-v-b");
}

function baseVertexIndex(id: string): number {
  return Number(id.replace("pyr-v-b", ""));
}

/** Ребро основания между min x и max x (среди вершин основания); иначе единственное ребро основания вне 2D-контура. */
function computeSoleDashedBaseEdgeKey(
  figure: SpaceFigure,
  projected: ScreenVertex[],
  hullEdgeKeys: Set<string>,
): string | null {
  const basePts = projected.filter((p) => isBaseVertexId(p.id));
  if (basePts.length < 2) return null;

  let left = basePts[0]!;
  let right = basePts[0]!;
  for (const p of basePts) {
    if (p.x < left.x - 1e-9 || (Math.abs(p.x - left.x) <= 1e-9 && p.y < left.y)) left = p;
    if (p.x > right.x + 1e-9 || (Math.abs(p.x - right.x) <= 1e-9 && p.y > right.y)) right = p;
  }
  if (left.id === right.id) return null;

  const directKey = edgeEndpointKey(left.id, right.id);
  for (const e of figure.edges) {
    if (!e.id.startsWith("pyr-e-b")) continue;
    if (edgeEndpointKey(e.aId, e.bId) === directKey) return directKey;
  }

  const hiddenBaseKeys = figure.edges
    .filter((e) => e.id.startsWith("pyr-e-b"))
    .map((e) => edgeEndpointKey(e.aId, e.bId))
    .filter((k) => !hullEdgeKeys.has(k));
  if (hiddenBaseKeys.length === 1) return hiddenBaseKeys[0]!;

  const n = (figure as PyramidFigure).baseLabels.length;
  const li = baseVertexIndex(left.id);
  const ri = baseVertexIndex(right.id);
  if (!Number.isFinite(li) || !Number.isFinite(ri) || n < 3) {
    return hiddenBaseKeys[0] ?? null;
  }

  const collectArc = (from: number, to: number, step: number): string[] => {
    const keys: string[] = [];
    let i = from;
    for (let guard = 0; guard <= n && i !== to; guard += 1) {
      const j = (i + step + n) % n;
      keys.push(edgeEndpointKey(`pyr-v-b${i}`, `pyr-v-b${j}`));
      i = j;
    }
    return keys;
  };

  const arcA = collectArc(li, ri, 1);
  const arcB = collectArc(li, ri, -1);
  const offA = arcA.filter((k) => !hullEdgeKeys.has(k));
  const offB = arcB.filter((k) => !hullEdgeKeys.has(k));
  if (offA.length === 1) return offA[0]!;
  if (offB.length === 1) return offB[0]!;
  if (offA.length > 0 && offB.length === 0) return offA[0]!;
  if (offB.length > 0 && offA.length === 0) return offB[0]!;

  return hiddenBaseKeys[0] ?? null;
}

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

  let soleDashedBodyEdgeKey: string | null = null;
  if (isPyramid(body) && interiorVertexIds.size === 0) {
    soleDashedBodyEdgeKey = computeSoleDashedBaseEdgeKey(body, projected, hullEdgeKeys);
  }

  const pyramidObserver =
    isPyramid(body)
      ? buildPyramidObserver(body, resolved, resolved.projection, {
          hull,
          hullEdgeKeys,
          interiorVertexIds,
          soleDashedBodyEdgeKey,
        })
      : undefined;

  return { hull, hullEdgeKeys, interiorVertexIds, soleDashedBodyEdgeKey, pyramidObserver };
}

/**
 * Ребро сплошное, если ни одна вершина не внутри контура;
 * при пустом interior — пунктиром только soleDashedBodyEdgeKey;
 * иначе пунктир, если инцидентна «внутренней» вершине.
 */
export function isBodyEdgeVisibleProjectionHull(
  aId: string,
  bId: string,
  hull: ProjectionHull,
): boolean {
  if (hull.interiorVertexIds.size > 0) {
    if (hull.interiorVertexIds.has(aId) || hull.interiorVertexIds.has(bId)) return false;
    return true;
  }
  if (hull.soleDashedBodyEdgeKey) {
    return edgeEndpointKey(aId, bId) !== hull.soleDashedBodyEdgeKey;
  }
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

function isPointOnHiddenBodyEdge(
  world: Vec3,
  figure: SpaceFigure,
  points: Map<string, BuiltSpacePoint>,
  hull: ProjectionHull,
): boolean {
  const on = locatePointOnFigureEdge(world, figure, points);
  if (!on) return false;
  return !isBodyEdgeVisibleProjectionHull(on.aId, on.bId, hull);
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

  if (
    isPointOnHiddenBodyEdge(aWorld, figure, resolved.points, hull) &&
    isPointOnHiddenBodyEdge(bWorld, figure, resolved.points, hull)
  ) {
    return false;
  }

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

/** ID вершин тела, «дальних» (скрытых/пунктирных) и «ближних» (контур/видимых) при текущем повороте. */
function pyramidNearFarVertexIds(
  figure: SpaceFigure,
  hull: ProjectionHull,
): { nearIds: string[]; farIds: string[] } {
  const allIds = figure.vertices.map((v) => v.id);
  if (hull.interiorVertexIds.size > 0) {
    const farIds = allIds.filter((id) => hull.interiorVertexIds.has(id));
    const nearIds = allIds.filter((id) => !hull.interiorVertexIds.has(id));
    return { nearIds, farIds };
  }
  if (hull.soleDashedBodyEdgeKey) {
    const farIds = hull.soleDashedBodyEdgeKey.split("|");
    const nearIds = allIds.filter((id) => !farIds.includes(id));
    return { nearIds, farIds };
  }
  return { nearIds: allIds, farIds: [] };
}

/**
 * Ось глубины пирамиды, ВЫВЕДЕННАЯ из уже корректно определённой видимости
 * рёбер тела (contour/hull), а не из отдельно угаданного вектора «глаза».
 *
 * Идея: у нас уже есть надёжная классификация вершин тела на «ближние»
 * (видимый контур) и «дальние» (скрытые/пунктирные) для ТЕКУЩЕГО поворота —
 * ею определяется, какие рёбра рисуются сплошными, а какие пунктиром.
 * Вектор «центр дальних → центр ближних» — это и есть направление «к
 * зрителю» для ЭТОГО конкретного вида, согласованное с тем, что уже
 * нарисовано, а не отдельное (потенциально неверное) предположение о
 * положении глаза. Заменяет собой фиксированный вектор (4,4,1), который
 * не был привязан к видимости тела и давал верный порядок «через раз».
 */
export function deriveHullDepthAxis(
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  hull: ProjectionHull,
): Vec3 | null {
  const { nearIds, farIds } = pyramidNearFarVertexIds(figure, hull);
  if (!nearIds.length || !farIds.length) return null;
  const nearPts = nearIds.map((id) => resolved.points.get(id)?.world).filter(Boolean) as Vec3[];
  const farPts = farIds.map((id) => resolved.points.get(id)?.world).filter(Boolean) as Vec3[];
  if (!nearPts.length || !farPts.length) return null;
  const nearC = scale(
    nearPts.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }),
    1 / nearPts.length,
  );
  const farC = scale(
    farPts.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }),
    1 / farPts.length,
  );
  const d = sub(farC, nearC);
  const dl = len(d);
  if (dl < 1e-9) return null;
  return scale(d, 1 / dl);
}

export function isPlaneFragmentVisibleProjectionHull(
  fragment: Vec3[],
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  hull: ProjectionHull,
): boolean {
  if (fragment.length < 3) return true;
  const c = polygonCentroid(fragment);
  return !pointOnHiddenFace(c, figure, resolved, hull);
}
