/**
 * Видимость рёбер призмы: глубина граней сравнивается только там, где их
 * экранные проекции перекрываются по внутренности (общие точки на границе
 * не считаются). Не использует выпуклую оболочку пирамиды.
 */
import type { ResolvedSpaceScene } from "./build";
import { projectFromLocalCoeffs, worldViewSortDepth } from "./camera";
import { adjacentFaceIds, edgeById } from "./figure";
import type { PrismFigure, SpaceViewParams, Vec3 } from "./types";
import { add, scale } from "./vec3";
import { isFaceFrontFacingFigure } from "./visibility-school";

const DEPTH_EPS = 1e-5;
const BOUNDARY_EPS = 1e-5;

type ScreenPoly = Array<{ x: number; y: number }>;

interface PrismVisibilityState {
  faceDepths: Map<string, number>;
  faceScreen: Map<string, ScreenPoly>;
  faceVisible: Map<string, boolean>;
}

let prismVisCacheKey = "";
let prismVisCache: PrismVisibilityState | null = null;

function faceCentroidWorld(
  vertexIds: string[],
  resolved: ResolvedSpaceScene,
): Vec3 | null {
  const pts: Vec3[] = [];
  for (const id of vertexIds) {
    const w = resolved.points.get(id)?.world;
    if (w) pts.push(w);
  }
  if (!pts.length) return null;
  return scale(
    pts.reduce((acc, p) => add(acc, p), { x: 0, y: 0, z: 0 }),
    1 / pts.length,
  );
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

/** Строго внутри выпуклого многоугольника (точки на рёбрах и в вершинах — нет). */
function pointStrictlyInsidePoly(px: number, py: number, poly: ScreenPoly): boolean {
  if (poly.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (Math.abs(cross) <= BOUNDARY_EPS) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  if (sign === 0) return false;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if (distPointToSegment2D(px, py, a.x, a.y, b.x, b.y) <= BOUNDARY_EPS) return false;
  }
  return true;
}

function bilinearPoint(
  v0: { x: number; y: number },
  v1: { x: number; y: number },
  v2: { x: number; y: number },
  v3: { x: number; y: number },
  u: number,
  v: number,
): { x: number; y: number } {
  const a = { x: v0.x + u * (v1.x - v0.x), y: v0.y + u * (v1.y - v0.y) };
  const b = { x: v3.x + u * (v2.x - v3.x), y: v3.y + u * (v2.y - v3.y) };
  return { x: a.x + v * (b.x - a.x), y: a.y + v * (b.y - a.y) };
}

/** Несколько точек гарантированно внутри грани (не на границе), если грань невырождена. */
function interiorSamples(poly: ScreenPoly): Array<{ x: number; y: number }> {
  if (poly.length === 3) {
    const [v0, v1, v2] = poly;
    return [
      { x: (v0!.x + v1!.x + v2!.x) / 3, y: (v0!.y + v1!.y + v2!.y) / 3 },
      { x: (v0!.x + v1!.x) * 0.5 * 0.4 + v2!.x * 0.6, y: (v0!.y + v1!.y) * 0.5 * 0.4 + v2!.y * 0.6 },
    ];
  }
  if (poly.length >= 4) {
    const [v0, v1, v2, v3] = poly;
    const samples: Array<{ x: number; y: number }> = [];
    for (const u of [0.35, 0.65]) {
      for (const v of [0.35, 0.65]) {
        samples.push(bilinearPoint(v0!, v1!, v2!, v3!, u, v));
      }
    }
    return samples;
  }
  return [];
}

/** Есть ли общая внутренняя область в экранной проекции (касание только по ребру/вершине — нет). */
export function facesHaveInteriorScreenOverlap(polyA: ScreenPoly, polyB: ScreenPoly): boolean {
  for (const p of [...interiorSamples(polyA), ...interiorSamples(polyB)]) {
    if (pointStrictlyInsidePoly(p.x, p.y, polyA) && pointStrictlyInsidePoly(p.x, p.y, polyB)) {
      return true;
    }
  }
  return false;
}

export function computePrismFaceDepths(
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): Map<string, number> {
  const mode = view.planeFillDepthMode ?? "eye";
  const depths = new Map<string, number>();
  for (const face of figure.faces) {
    const center = faceCentroidWorld(face.vertexIds, resolved);
    if (!center) {
      depths.set(face.id, Number.POSITIVE_INFINITY);
      continue;
    }
    depths.set(
      face.id,
      worldViewSortDepth(center, resolved.basis, resolved.projection, figure, mode),
    );
  }
  return depths;
}

function buildFaceScreenPolys(
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): Map<string, ScreenPoly> {
  const out = new Map<string, ScreenPoly>();
  for (const face of figure.faces) {
    const poly = face.vertexIds
      .map((id) => {
        const pt = resolved.points.get(id);
        if (!pt) return null;
        const pr = projectFromLocalCoeffs(pt.local, pt.world, view, resolved.projection, figure);
        return { x: pr.x, y: pr.y };
      })
      .filter(Boolean) as ScreenPoly;
    if (poly.length >= 3) out.set(face.id, poly);
  }
  return out;
}

function isFaceVisibleWithOverlapRules(
  faceId: string,
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  faceDepths: Map<string, number>,
  faceScreen: Map<string, ScreenPoly>,
): boolean {
  if (!isFaceFrontFacingFigure(faceId, figure, resolved)) return false;
  const polyF = faceScreen.get(faceId);
  if (!polyF) return false;
  const dF = faceDepths.get(faceId) ?? Number.POSITIVE_INFINITY;

  for (const other of figure.faces) {
    if (other.id === faceId) continue;
    if (!isFaceFrontFacingFigure(other.id, figure, resolved)) continue;
    const polyG = faceScreen.get(other.id);
    if (!polyG) continue;
    if (!facesHaveInteriorScreenOverlap(polyF, polyG)) continue;
    const dG = faceDepths.get(other.id) ?? Number.POSITIVE_INFINITY;
    if (dG < dF - DEPTH_EPS) return false;
  }
  return true;
}

function buildPrismVisibilityState(
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  faceDepths?: Map<string, number>,
): PrismVisibilityState {
  const depths = faceDepths ?? computePrismFaceDepths(figure, resolved, view);
  const faceScreen = buildFaceScreenPolys(figure, resolved, view);
  const faceVisible = new Map<string, boolean>();
  for (const face of figure.faces) {
    faceVisible.set(
      face.id,
      isFaceVisibleWithOverlapRules(face.id, figure, resolved, depths, faceScreen),
    );
  }
  return { faceDepths: depths, faceScreen, faceVisible };
}

function prismVisibilityState(
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  faceDepths?: Map<string, number>,
): PrismVisibilityState {
  if (faceDepths) {
    return buildPrismVisibilityState(figure, resolved, view, faceDepths);
  }
  const p = resolved.projection;
  const key = `${figure.id}:${view.scale}:${view.yaw}:${p.kx}:${p.ky}:${p.yawRad}`;
  if (key !== prismVisCacheKey || !prismVisCache) {
    prismVisCacheKey = key;
    prismVisCache = buildPrismVisibilityState(figure, resolved, view);
  }
  return prismVisCache;
}

/**
 * Сплошное, если хотя бы одна смежная грань передняя и не прикрыта другой
 * передней гранью в общей внутренней области проекции.
 */
export function isBodyEdgeVisiblePrism(
  edgeId: string,
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  faceDepths?: Map<string, number>,
): boolean {
  const edge = edgeById(figure, edgeId);
  if (!edge) return true;

  const state = prismVisibilityState(figure, resolved, view, faceDepths);
  const adjacent = adjacentFaceIds(figure, edgeId);

  if (adjacent.length === 0) return true;
  for (const faceId of adjacent) {
    if (state.faceVisible.get(faceId)) return true;
  }
  return false;
}

export function isFaceVisiblePrism(
  faceId: string,
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  faceDepths?: Map<string, number>,
): boolean {
  const state = prismVisibilityState(figure, resolved, view, faceDepths);
  return state.faceVisible.get(faceId) ?? false;
}
