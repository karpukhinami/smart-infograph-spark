/**
 * Видимость рёбер призмы: глубина сравнивается только у не смежных граней,
 * у которых проекции перекрываются по внутренности (не по границе). Смежные
 * в 3D грани (общее ребро) глубину друг с другом не сравнивают.
 */
import type { ResolvedSpaceScene } from "./build";
import { projectFromLocalCoeffs, worldViewSortDepth } from "./camera";
import { adjacentFaceIds, edgeById, faceById, facesShareEdge } from "./figure";
import type { PrismFigure, SpaceViewParams, Vec3 } from "./types";
import { add, scale } from "./vec3";
import { isFaceFrontFacingFigure } from "./visibility-school";

const DEPTH_EPS = 1e-5;
const BOUNDARY_EPS = 1e-5;

type ScreenVert = { x: number; y: number; depth: number };
type ScreenPoly = ScreenVert[];

interface PrismVisibilityState {
  faceVisible: Map<string, boolean>;
  edgeVisible: Map<string, boolean>;
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
  v0: ScreenVert,
  v1: ScreenVert,
  v2: ScreenVert,
  v3: ScreenVert,
  u: number,
  v: number,
): { x: number; y: number } {
  const a = { x: v0.x + u * (v1.x - v0.x), y: v0.y + u * (v1.y - v0.y) };
  const b = { x: v3.x + u * (v2.x - v3.x), y: v3.y + u * (v2.y - v3.y) };
  return { x: a.x + v * (b.x - a.x), y: a.y + v * (b.y - a.y) };
}

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

/** Точка, лежащая строго внутри обеих проекций (если есть). */
function findInteriorOverlapSample(polyA: ScreenPoly, polyB: ScreenPoly): { x: number; y: number } | null {
  for (const p of [...interiorSamples(polyA), ...interiorSamples(polyB)]) {
    if (pointStrictlyInsidePoly(p.x, p.y, polyA) && pointStrictlyInsidePoly(p.x, p.y, polyB)) {
      return p;
    }
  }
  return null;
}

export function facesHaveInteriorScreenOverlap(polyA: ScreenPoly, polyB: ScreenPoly): boolean {
  return findInteriorOverlapSample(polyA, polyB) !== null;
}

function depthAtScreenPoint(px: number, py: number, poly: ScreenPoly): number | null {
  if (poly.length === 3) {
    const [v0, v1, v2] = poly;
    const den =
      (v1!.y - v2!.y) * (v0!.x - v2!.x) + (v2!.x - v1!.x) * (v0!.y - v2!.y);
    if (Math.abs(den) < 1e-12) return (v0!.depth + v1!.depth + v2!.depth) / 3;
    const w0 =
      ((v1!.y - v2!.y) * (px - v2!.x) + (v2!.x - v1!.x) * (py - v2!.y)) / den;
    const w1 =
      ((v2!.y - v0!.y) * (px - v2!.x) + (v0!.x - v2!.x) * (py - v2!.y)) / den;
    const w2 = 1 - w0 - w1;
    if (w0 < -1e-7 || w1 < -1e-7 || w2 < -1e-7) return null;
    return w0 * v0!.depth + w1 * v1!.depth + w2 * v2!.depth;
  }
  if (poly.length >= 4) {
    const [v0, v1, v2, v3] = poly;
    const denom = (v2!.x - v0!.x) * (v3!.y - v0!.y) - (v2!.y - v0!.y) * (v3!.x - v0!.x);
    if (Math.abs(denom) < 1e-12) {
      return (v0!.depth + v1!.depth + v2!.depth + v3!.depth) * 0.25;
    }
    const u = ((px - v0!.x) * (v3!.y - v0!.y) - (py - v0!.y) * (v3!.x - v0!.x)) / denom;
    const v = ((px - v0!.x) * (v1!.y - v0!.y) - (py - v0!.y) * (v1!.x - v0!.x)) / denom;
    const d0 = v0!.depth + u * (v1!.depth - v0!.depth) + v * (v3!.depth - v0!.depth);
    const d1 = v0!.depth + u * (v2!.depth - v0!.depth) + v * (v3!.depth - v0!.depth);
    return (d0 + d1) * 0.5;
  }
  return null;
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
        return { x: pr.x, y: pr.y, depth: pr.depth };
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
  faceScreen: Map<string, ScreenPoly>,
): boolean {
  if (!isFaceFrontFacingFigure(faceId, figure, resolved)) return false;
  const polyF = faceScreen.get(faceId);
  if (!polyF) return false;

  for (const other of figure.faces) {
    if (other.id === faceId) continue;
    if (facesShareEdge(figure, faceId, other.id)) continue;
    if (!isFaceFrontFacingFigure(other.id, figure, resolved)) continue;
    const polyG = faceScreen.get(other.id);
    if (!polyG) continue;
    const sample = findInteriorOverlapSample(polyF, polyG);
    if (!sample) continue;
    const dF = depthAtScreenPoint(sample.x, sample.y, polyF);
    const dG = depthAtScreenPoint(sample.x, sample.y, polyG);
    if (dF === null || dG === null) continue;
    if (dG < dF - DEPTH_EPS) return false;
  }
  return true;
}

function buildEdgeVisibility(
  figure: PrismFigure,
  faceVisible: Map<string, boolean>,
): Map<string, boolean> {
  const edgeVisible = new Map<string, boolean>();
  for (const edge of figure.edges) {
    const adj = adjacentFaceIds(figure, edge.id);
    let visible = false;
    for (const faceId of adj) {
      if (faceVisible.get(faceId)) {
        visible = true;
        break;
      }
    }
    edgeVisible.set(edge.id, visible);
  }

  for (const face of figure.faces) {
    if (!faceVisible.get(face.id)) continue;
    for (const edge of figure.edges) {
      if (!face.vertexIds.includes(edge.aId) || !face.vertexIds.includes(edge.bId)) continue;
      edgeVisible.set(edge.id, true);
    }
  }
  return edgeVisible;
}

function buildPrismVisibilityState(
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): PrismVisibilityState {
  const faceScreen = buildFaceScreenPolys(figure, resolved, view);
  const faceVisible = new Map<string, boolean>();
  for (const face of figure.faces) {
    faceVisible.set(
      face.id,
      isFaceVisibleWithOverlapRules(face.id, figure, resolved, faceScreen),
    );
  }
  const edgeVisible = buildEdgeVisibility(figure, faceVisible);
  return { faceVisible, edgeVisible };
}

function prismVisibilityState(
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): PrismVisibilityState {
  const p = resolved.projection;
  const key = `${figure.id}:${view.scale}:${view.yaw}:${p.kx}:${p.ky}:${p.yawRad}:${figure.faces.length}:${figure.edges.length}`;
  if (key !== prismVisCacheKey || !prismVisCache) {
    prismVisCacheKey = key;
    prismVisCache = buildPrismVisibilityState(figure, resolved, view);
  }
  return prismVisCache;
}

export function isBodyEdgeVisiblePrism(
  edgeId: string,
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  _faceDepths?: Map<string, number>,
): boolean {
  const edge = edgeById(figure, edgeId);
  if (!edge) return true;
  const state = prismVisibilityState(figure, resolved, view);
  return state.edgeVisible.get(edgeId) ?? true;
}

export function isFaceVisiblePrism(
  faceId: string,
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  _faceDepths?: Map<string, number>,
): boolean {
  if (!faceById(figure, faceId)) return false;
  const state = prismVisibilityState(figure, resolved, view);
  return state.faceVisible.get(faceId) ?? false;
}
