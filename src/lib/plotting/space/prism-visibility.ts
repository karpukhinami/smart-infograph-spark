/**

 * Видимость рёбер призмы: глубина сравнивается только у пар граней без общих

 * вершин, у которых проекции перекрываются строго по внутренности.

 */

import type { ResolvedSpaceScene } from "./build";

import { projectFromLocalCoeffs } from "./camera";

import { adjacentFaceIds, edgeById, faceById, facesShareVertex } from "./figure";

import type { PrismFigure, SpaceFigure, SpaceViewParams } from "./types";

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



/** Точки внутри n-угольника (веер от v0), не только четырёхугольника. */

function interiorSamples(poly: ScreenPoly): Array<{ x: number; y: number }> {

  if (poly.length < 3) return [];

  const v0 = poly[0]!;

  const samples: Array<{ x: number; y: number }> = [];

  for (let i = 1; i + 1 < poly.length; i += 1) {

    const v1 = poly[i]!;

    const v2 = poly[i + 1]!;

    samples.push({

      x: (v0.x + v1.x + v2.x) / 3,

      y: (v0.y + v1.y + v2.y) / 3,

    });

    samples.push({

      x: (v0.x * 0.2 + v1.x * 0.4 + v2.x * 0.4),

      y: (v0.y * 0.2 + v1.y * 0.4 + v2.y * 0.4),

    });

  }

  return samples;

}



function depthInTriangle(

  px: number,

  py: number,

  v0: ScreenVert,

  v1: ScreenVert,

  v2: ScreenVert,

): number | null {

  const den =

    (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);

  if (Math.abs(den) < 1e-12) return null;

  const w0 =

    ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / den;

  const w1 =

    ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / den;

  const w2 = 1 - w0 - w1;

  if (w0 < -1e-7 || w1 < -1e-7 || w2 < -1e-7) return null;

  return w0 * v0.depth + w1 * v1.depth + w2 * v2.depth;

}



/** Глубина в экранной точке по вееру треугольников (корректно для n-угольника). */

function depthAtScreenPoint(px: number, py: number, poly: ScreenPoly): number | null {

  if (poly.length < 3) return null;

  const v0 = poly[0]!;

  for (let i = 1; i + 1 < poly.length; i += 1) {

    const d = depthInTriangle(px, py, v0, poly[i]!, poly[i + 1]!);

    if (d !== null) return d;

  }

  return null;

}



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



export function computeFigureFaceDepths(

  figure: SpaceFigure,

  resolved: ResolvedSpaceScene,

  view: SpaceViewParams,

): Map<string, number> {

  const faceScreen = buildFaceScreenPolys(figure, resolved, view);

  const depths = new Map<string, number>();

  for (const face of figure.faces) {

    const poly = faceScreen.get(face.id);

    if (!poly?.length) {

      depths.set(face.id, Number.POSITIVE_INFINITY);

      continue;

    }

    let sx = 0;

    let sy = 0;

    for (const v of poly) {

      sx += v.x;

      sy += v.y;

    }

    sx /= poly.length;

    sy /= poly.length;

    depths.set(face.id, depthAtScreenPoint(sx, sy, poly) ?? Number.POSITIVE_INFINITY);

  }

  return depths;

}



/** @deprecated используйте computeFigureFaceDepths */

export const computePrismFaceDepths = computeFigureFaceDepths;



function buildFaceScreenPolys(

  figure: SpaceFigure,

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



function isFaceBlockedByOverlap(

  faceId: string,

  figure: PrismFigure,

  resolved: ResolvedSpaceScene,

  faceScreen: Map<string, ScreenPoly>,

): boolean {

  const polyF = faceScreen.get(faceId);

  if (!polyF) return true;



  for (const other of figure.faces) {

    if (other.id === faceId) continue;

    if (facesShareVertex(figure, faceId, other.id)) continue;

    if (!isFaceFrontFacingFigure(other.id, figure, resolved)) continue;

    const polyG = faceScreen.get(other.id);

    if (!polyG) continue;

    const sample = findInteriorOverlapSample(polyF, polyG);

    if (!sample) continue;

    const dF = depthAtScreenPoint(sample.x, sample.y, polyF);

    const dG = depthAtScreenPoint(sample.x, sample.y, polyG);

    if (dF === null || dG === null) continue;

    if (dG < dF - DEPTH_EPS) return true;

  }

  return false;

}



function buildPrismVisibilityState(

  figure: PrismFigure,

  resolved: ResolvedSpaceScene,

  view: SpaceViewParams,

): PrismVisibilityState {

  const faceScreen = buildFaceScreenPolys(figure, resolved, view);

  const faceVisible = new Map<string, boolean>();

  for (const face of figure.faces) {

    const front = isFaceFrontFacingFigure(face.id, figure, resolved);

    const blocked = front && isFaceBlockedByOverlap(face.id, figure, resolved, faceScreen);

    faceVisible.set(face.id, front && !blocked);

  }



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


