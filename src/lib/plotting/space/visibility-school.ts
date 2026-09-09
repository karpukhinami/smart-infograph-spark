/**
 * Школьная фиксированная проекция и видимость (u,v,w + k=0.28).
 * Альтернатива legacy-режиму в visibility.ts.
 */
import { localToView, viewDirectionLocal, type ViewBasis } from "./camera";
import type { SpaceViewParams } from "./types";
import { faceById } from "./parallelepiped";
import type { ParallelepipedFigure, LocalCoords, SpaceViewParams, Vec3 } from "./types";
import { add, dotLocal, len, scale, sub, worldToLocal } from "./vec3";
import type { ResolvedSpaceScene } from "./build";
import type { LineSplitSegment } from "./visibility";

const T_EPS = 1e-7;
const SURFACE_EPS = 1e-5;
const UNIT_EPS = 1e-4;
const FACE_EPS = 1e-4;
const DEPTH_EPS = 1e-4;

type ScreenPt = { x: number; y: number; z: number };

const BOX_FACE_TO_FACE_ID: Record<string, string> = {
  u0: "f-left",
  u1: "f-right",
  v0: "f-front",
  v1: "f-back",
  w0: "f-bottom",
  w1: "f-top",
};

function localOnBoxFace(l: LocalCoords): string | null {
  if (Math.abs(l.u) < FACE_EPS) return "u0";
  if (Math.abs(l.u - 1) < FACE_EPS) return "u1";
  if (Math.abs(l.v) < FACE_EPS) return "v0";
  if (Math.abs(l.v - 1) < FACE_EPS) return "v1";
  if (Math.abs(l.w) < FACE_EPS) return "w0";
  if (Math.abs(l.w - 1) < FACE_EPS) return "w1";
  return null;
}

function segmentOnSharedFrontFace(
  la: LocalCoords,
  lb: LocalCoords,
  view: SpaceViewParams,
): boolean {
  const fa = localOnBoxFace(la);
  const fb = localOnBoxFace(lb);
  if (!fa || fa !== fb) return false;
  const faceId = BOX_FACE_TO_FACE_ID[fa];
  return faceId ? isFaceFrontFacing(faceId, view) : false;
}

/** Грани, обращённые к наблюдателю при фиксированном k. */
const FRONT_FACE_IDS = new Set(["f-left", "f-back", "f-top"]);

/** Рёбро → две прилегающие грани. */
const EDGE_FACES: Record<string, [string, string]> = {
  "e-ab": ["f-bottom", "f-front"],
  "e-bc": ["f-bottom", "f-right"],
  "e-cd": ["f-bottom", "f-back"],
  "e-da": ["f-bottom", "f-left"],
  "e-a1b1": ["f-top", "f-front"],
  "e-b1c1": ["f-top", "f-right"],
  "e-c1d1": ["f-top", "f-back"],
  "e-d1a1": ["f-top", "f-left"],
  "e-aa1": ["f-front", "f-left"],
  "e-bb1": ["f-front", "f-right"],
  "e-cc1": ["f-back", "f-right"],
  "e-dd1": ["f-back", "f-left"],
};

/** Внешняя нормаль грани в локальных (u,v,w). */
const FACE_NORMALS: Record<string, LocalCoords> = {
  "f-left": { u: -1, v: 0, w: 0 },
  "f-right": { u: 1, v: 0, w: 0 },
  "f-front": { u: 0, v: -1, w: 0 },
  "f-back": { u: 0, v: 1, w: 0 },
  "f-bottom": { u: 0, v: 0, w: -1 },
  "f-top": { u: 0, v: 0, w: 1 },
};

export function isFaceFrontFacing(faceId: string, view: SpaceViewParams): boolean {
  const n = FACE_NORMALS[faceId];
  if (!n) return false;
  const vd = viewDirectionLocal(view);
  return dotLocal(n, vd) < -SURFACE_EPS;
}

export function isBodyEdgeVisibleSchool(
  edgeId: string,
  _figure: ParallelepipedFigure,
  view: SpaceViewParams,
): boolean {
  const pair = EDGE_FACES[edgeId];
  if (!pair) return true;
  return isFaceFrontFacing(pair[0], view) || isFaceFrontFacing(pair[1], view);
}

function inUnit(x: number): boolean {
  return x >= -UNIT_EPS && x <= 1 + UNIT_EPS;
}

/** Закрыта ли точка P=(u,v,w) поверхностью параллелепипеда (луч вдоль viewDirection). */
export function isPointOccludedLocal(local: LocalCoords, view: SpaceViewParams): boolean {
  const { u, v, w } = local;
  const vd = viewDirectionLocal(view);

  const hit = (t: number, check: () => boolean): boolean => {
    if (Math.abs(t) <= SURFACE_EPS) return false;
    if (t >= -T_EPS) return false;
    return check();
  };

  if (u > SURFACE_EPS) {
    const t = -u / vd.u;
    if (hit(t, () => inUnit(v + t * vd.v) && inUnit(w + t * vd.w))) return true;
  }
  if (u < 1 - SURFACE_EPS) {
    const t = (1 - u) / vd.u;
    if (hit(t, () => inUnit(v + t * vd.v) && inUnit(w + t * vd.w))) return true;
  }
  if (v > SURFACE_EPS) {
    const t = -v / vd.v;
    if (hit(t, () => inUnit(u + t * vd.u) && inUnit(w + t * vd.w))) return true;
  }
  if (v < 1 - SURFACE_EPS) {
    const t = (1 - v) / vd.v;
    if (hit(t, () => inUnit(u + t * vd.u) && inUnit(w + t * vd.w))) return true;
  }
  if (w > SURFACE_EPS) {
    const t = -w / vd.w;
    if (hit(t, () => inUnit(u + t * vd.u) && inUnit(v + t * vd.v))) return true;
  }
  if (w < 1 - SURFACE_EPS) {
    const t = (1 - w) / vd.w;
    if (hit(t, () => inUnit(u + t * vd.u) && inUnit(v + t * vd.v))) return true;
  }
  return false;
}

function mergeBreakpoints(values: number[], t0: number, t1: number): number[] {
  const sorted = [...values, t0, t1].sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of sorted) {
    if (t < t0 - T_EPS || t > t1 + T_EPS) continue;
    const clamped = Math.min(t1, Math.max(t0, t));
    if (!out.length || Math.abs(clamped - out[out.length - 1]!) > T_EPS) out.push(clamped);
  }
  return out;
}

function mergeAdjacent(segments: LineSplitSegment[]): LineSplitSegment[] {
  if (segments.length < 2) return segments;
  const out: LineSplitSegment[] = [{ ...segments[0]! }];
  for (let i = 1; i < segments.length; i += 1) {
    const prev = out[out.length - 1]!;
    const cur = segments[i]!;
    if (cur.visible === prev.visible && len(sub(cur.a, prev.b)) < 1e-6) {
      prev.b = cur.b;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** 3D-пересечения линии с гранями параллелепипеда (в локальных координатах). */
function facePlaneBreakpointsLocal(
  originL: LocalCoords,
  dirL: LocalCoords,
  t0: number,
  t1: number,
): number[] {
  const bps: number[] = [];
  const { u: ou, v: ov, w: ow } = originL;
  const { u: du, v: dv, w: dw } = dirL;

  const tryAdd = (t: number, u: number, v: number, w: number) => {
    if (t < t0 - T_EPS || t > t1 + T_EPS) return;
    if (inUnit(u) && inUnit(v) && inUnit(w)) bps.push(t);
  };

  if (Math.abs(du) > T_EPS) {
    tryAdd((0 - ou) / du, 0, ov + ((0 - ou) / du) * dv, ow + ((0 - ou) / du) * dw);
    tryAdd((1 - ou) / du, 1, ov + ((1 - ou) / du) * dv, ow + ((1 - ou) / du) * dw);
  }
  if (Math.abs(dv) > T_EPS) {
    tryAdd((0 - ov) / dv, ou + ((0 - ov) / dv) * du, 0, ow + ((0 - ov) / dv) * dw);
    tryAdd((1 - ov) / dv, ou + ((1 - ov) / dv) * du, 1, ow + ((1 - ov) / dv) * dw);
  }
  if (Math.abs(dw) > T_EPS) {
    tryAdd((0 - ow) / dw, ou + ((0 - ow) / dw) * du, ov + ((0 - ow) / dw) * dv, 0);
    tryAdd((1 - ow) / dw, ou + ((1 - ow) / dw) * du, ov + ((1 - ow) / dw) * dv, 1);
  }
  return bps;
}

function projectLocalForScreen(
  local: LocalCoords,
  view: SpaceViewParams,
  basis?: ViewBasis,
): { x: number; y: number; z: number } {
  const s = view.scale;
  const v = localToView(local, view, basis);
  return { x: v.x * s, y: -v.y * s, z: v.z };
}

function pointInQuad2D(px: number, py: number, verts: Array<{ x: number; y: number }>): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = verts[i]!;
    const b = verts[(i + 1) % 4]!;
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (Math.abs(cross) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return sign !== 0;
}

function pointInPolygon2D(px: number, py: number, verts: Array<{ x: number; y: number }>): boolean {
  if (verts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i]!.x;
    const yi = verts[i]!.y;
    const xj = verts[j]!.x;
    const yj = verts[j]!.y;
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function depthOnFaceQuad(px: number, py: number, verts: ScreenPt[]): number {
  const [v0, v1, v2, v3] = verts;
  const denom = (v2!.x - v0!.x) * (v3!.y - v0!.y) - (v2!.y - v0!.y) * (v3!.x - v0!.x);
  if (Math.abs(denom) < 1e-12) {
    return (v0!.z + v1!.z + v2!.z + v3!.z) * 0.25;
  }
  const u = ((px - v0!.x) * (v3!.y - v0!.y) - (py - v0!.y) * (v3!.x - v0!.x)) / denom;
  const v = ((px - v0!.x) * (v1!.y - v0!.y) - (py - v0!.y) * (v1!.x - v0!.x)) / denom;
  const d0 = v0!.z + u * (v1!.z - v0!.z) + v * (v3!.z - v0!.z);
  const d1 = v0!.z + u * (v2!.z - v0!.z) + v * (v3!.z - v0!.z);
  return (d0 + d1) * 0.5;
}

/** Ближайшая к наблюдателю поверхность среди передних граней в экранной точке. */
function frontSurfaceDepthSchool(
  px: number,
  py: number,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): number | null {
  let best: number | null = null;
  for (const faceId of FRONT_FACE_IDS) {
    const face = faceById(figure, faceId);
    if (!face) continue;
    const quad = face.vertexIds
      .map((id) => {
        const pt = resolved.points.get(id);
        if (!pt) return null;
        return projectLocalForScreen(pt.local, view, resolved.basis);
      })
      .filter(Boolean) as ScreenPt[];
    if (quad.length !== 4) continue;
    if (!pointInQuad2D(px, py, quad)) continue;
    const z = depthOnFaceQuad(px, py, quad);
    if (best === null || z < best) best = z;
  }
  return best;
}

function onBackFace(local: LocalCoords, view: SpaceViewParams): boolean {
  const faceKey = localOnBoxFace(local);
  if (!faceKey) return false;
  const faceId = BOX_FACE_TO_FACE_ID[faceKey];
  return faceId ? !isFaceFrontFacing(faceId, view) : false;
}

/** 2D-контур силуэта: рёбра между передней и задней гранью. */
function buildSilhouettePolygon(
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): Array<{ x: number; y: number }> {
  const adj = new Map<string, string[]>();
  const coords = new Map<string, { x: number; y: number }>();

  for (const edge of figure.edges) {
    const pair = EDGE_FACES[edge.id];
    if (!pair) continue;
    if (isFaceFrontFacing(pair[0], view) === isFaceFrontFacing(pair[1], view)) continue;
    const { aId, bId } = edge;
    if (!adj.has(aId)) adj.set(aId, []);
    if (!adj.has(bId)) adj.set(bId, []);
    adj.get(aId)!.push(bId);
    adj.get(bId)!.push(aId);
    for (const id of [aId, bId]) {
      if (coords.has(id)) continue;
      const pt = resolved.points.get(id);
      if (!pt) continue;
      const s = projectLocalForScreen(pt.local, view, resolved.basis);
      coords.set(id, { x: s.x, y: s.y });
    }
  }

  if (adj.size < 3) return [];

  const start = [...adj.keys()].sort((a, b) => {
    const pa = coords.get(a)!;
    const pb = coords.get(b)!;
    if (pa.y !== pb.y) return pa.y - pb.y;
    return pa.x - pb.x;
  })[0]!;

  const pickNext = (cur: string, prev: string | null): string | null => {
    const nbs = adj.get(cur) ?? [];
    if (!nbs.length) return null;
    if (nbs.length === 1) return nbs[0]!;
    const pc = coords.get(cur)!;
    if (prev === null) {
      return [...nbs].sort((a, b) => {
        const aa = Math.atan2(coords.get(a)!.y - pc.y, coords.get(a)!.x - pc.x);
        const bb = Math.atan2(coords.get(b)!.y - pc.y, coords.get(b)!.x - pc.x);
        return aa - bb;
      })[0]!;
    }
    const ppc = coords.get(prev)!;
    const base = Math.atan2(pc.y - ppc.y, pc.x - ppc.x);
    const candidates = nbs.filter((n) => n !== prev);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => {
      const aa = Math.atan2(coords.get(a)!.y - pc.y, coords.get(a)!.x - pc.x) - base;
      const bb = Math.atan2(coords.get(b)!.y - pc.y, coords.get(b)!.x - pc.x) - base;
      const normA = ((aa % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const normB = ((bb % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return normA - normB;
    })[0]!;
  };

  const poly: Array<{ x: number; y: number }> = [];
  let cur = start;
  let prev: string | null = null;
  for (let guard = 0; guard < 24; guard += 1) {
    poly.push(coords.get(cur)!);
    const next = pickNext(cur, prev);
    if (!next || next === start) break;
    prev = cur;
    cur = next;
  }
  return poly;
}

function segSegIntersectionT2D(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number | null {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
  if (t < -T_EPS || t > 1 + T_EPS || u < -T_EPS || u > 1 + T_EPS) return null;
  return t;
}

function screenPointAtLocalT(
  originL: LocalCoords,
  dirL: LocalCoords,
  t: number,
  view: SpaceViewParams,
  basis: ViewBasis,
): ScreenPt {
  return projectLocalForScreen(
    {
      u: originL.u + t * dirL.u,
      v: originL.v + t * dirL.v,
      w: originL.w + t * dirL.w,
    },
    view,
    basis,
  );
}

function isMidpointVisibleSchool(
  lAt: LocalCoords,
  lBt: LocalCoords,
  midL: LocalCoords,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  silhouette: Array<{ x: number; y: number }>,
): boolean {
  if (segmentOnSharedFrontFace(lAt, lBt, view)) return true;
  if (isPointOccludedLocal(midL, view)) return false;

  const screen = projectLocalForScreen(midL, view, resolved.basis);
  const inSilhouette =
    silhouette.length >= 3 && pointInPolygon2D(screen.x, screen.y, silhouette);

  if (inSilhouette) {
    if (onBackFace(midL, view)) return false;
    const frontZ = frontSurfaceDepthSchool(screen.x, screen.y, figure, resolved, view);
    if (frontZ !== null && screen.z > frontZ + DEPTH_EPS) return false;
  }

  return true;
}

/** Clip отрезка (s0,s1) в 2D по выпуклому четырёхугольнику → [lo, hi] или null. */
function clipSegmentToQuad2D(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  quad: Array<{ x: number; y: number }>,
): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  for (let i = 0; i < 4; i += 1) {
    const q0 = quad[i]!;
    const q1 = quad[(i + 1) % 4]!;
    const ex = q1.x - q0.x;
    const ey = q1.y - q0.y;
    const nx = -ey;
    const ny = ex;
    const wx = ax - q0.x;
    const wy = ay - q0.y;
    const denom = nx * dx + ny * dy;
    const dist = nx * wx + ny * wy;
    if (Math.abs(denom) < 1e-12) {
      if (dist > 1e-9) return null;
      continue;
    }
    const t = -dist / denom;
    if (denom > 0) {
      if (t > t0) t0 = t;
    } else if (t < t1) {
      t1 = t;
    }
    if (t0 > t1 + 1e-9) return null;
  }
  return [t0, t1];
}

/** Точки смены видимости — пересечения 2D-проекции с контуром силуэта. */
function silhouetteBreakpoints(
  originL: LocalCoords,
  dirL: LocalCoords,
  t0: number,
  t1: number,
  silhouette: Array<{ x: number; y: number }>,
  view: SpaceViewParams,
  basis: ViewBasis,
): number[] {
  if (silhouette.length < 3) return [];
  const bps: number[] = [];
  const p0 = screenPointAtLocalT(originL, dirL, t0, view, basis);
  const p1 = screenPointAtLocalT(originL, dirL, t1, view, basis);

  for (let i = 0; i < silhouette.length; i += 1) {
    const a = silhouette[i]!;
    const b = silhouette[(i + 1) % silhouette.length]!;
    const hit = segSegIntersectionT2D(p0.x, p0.y, p1.x, p1.y, a.x, a.y, b.x, b.y);
    if (hit === null) continue;
    bps.push(t0 + hit * (t1 - t0));
  }
  return bps;
}

/** Разбиение линии по школьной модели видимости. */
export function splitLineSchoolView(
  originWorld: Vec3,
  dirWorld: Vec3,
  t0: number,
  t1: number,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): LineSplitSegment[] {
  const basis = resolved.basis;
  const dirLen = len(dirWorld);
  if (!(dirLen > 1e-9)) return [];

  const originL = worldToLocal(originWorld, basis) ?? { u: 0, v: 0, w: 0 };
  const endL = worldToLocal(add(originWorld, scale(dirWorld, 1)), basis);
  if (!endL) {
    return [
      {
        a: add(originWorld, scale(dirWorld, t0)),
        b: add(originWorld, scale(dirWorld, t1)),
        visible: true,
      },
    ];
  }
  const dirL: LocalCoords = {
    u: endL.u - originL.u,
    v: endL.v - originL.v,
    w: endL.w - originL.w,
  };

  const silhouette = buildSilhouettePolygon(figure, resolved, view);
  const bps = [
    ...facePlaneBreakpointsLocal(originL, dirL, t0, t1),
    ...silhouetteBreakpoints(originL, dirL, t0, t1, silhouette, view, basis),
  ];
  const sorted = mergeBreakpoints(bps, t0, t1);
  const segments: LineSplitSegment[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const ta = sorted[i]!;
    const tb = sorted[i + 1]!;
    if (tb - ta < T_EPS) continue;
    const tm = (ta + tb) * 0.5;
    const lAt: LocalCoords = {
      u: originL.u + ta * dirL.u,
      v: originL.v + ta * dirL.v,
      w: originL.w + ta * dirL.w,
    };
    const lBt: LocalCoords = {
      u: originL.u + tb * dirL.u,
      v: originL.v + tb * dirL.v,
      w: originL.w + tb * dirL.w,
    };
    const midL: LocalCoords = {
      u: originL.u + tm * dirL.u,
      v: originL.v + tm * dirL.v,
      w: originL.w + tm * dirL.w,
    };
    const visible = isMidpointVisibleSchool(
      lAt,
      lBt,
      midL,
      figure,
      resolved,
      view,
      silhouette,
    );
    segments.push({
      a: add(originWorld, scale(dirWorld, ta)),
      b: add(originWorld, scale(dirWorld, tb)),
      visible,
    });
  }

  if (!segments.length) {
    const tm = (t0 + t1) * 0.5;
    const lAt: LocalCoords = {
      u: originL.u + t0 * dirL.u,
      v: originL.v + t0 * dirL.v,
      w: originL.w + t0 * dirL.w,
    };
    const lBt: LocalCoords = {
      u: originL.u + t1 * dirL.u,
      v: originL.v + t1 * dirL.v,
      w: originL.w + t1 * dirL.w,
    };
    const midL: LocalCoords = {
      u: originL.u + tm * dirL.u,
      v: originL.v + tm * dirL.v,
      w: originL.w + tm * dirL.w,
    };
    return [
      {
        a: add(originWorld, scale(dirWorld, t0)),
        b: add(originWorld, scale(dirWorld, t1)),
        visible: isMidpointVisibleSchool(
          lAt,
          lBt,
          midL,
          figure,
          resolved,
          view,
          silhouette,
        ),
      },
    ];
  }

  return mergeAdjacent(segments);
}

export { FRONT_FACE_IDS, EDGE_FACES };
