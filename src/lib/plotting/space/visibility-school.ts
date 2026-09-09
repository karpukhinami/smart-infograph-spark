/**
 * Школьная фиксированная проекция и видимость (u,v,w + k=0.28).
 * Альтернатива legacy-режиму в visibility.ts.
 */
import { getViewK, localToView } from "./camera";
import { faceById } from "./parallelepiped";
import type { ParallelepipedFigure, LocalCoords, SpaceViewParams, Vec3 } from "./types";
import { add, dot, len, scale, sub, worldToLocal } from "./vec3";
import type { ResolvedSpaceScene } from "./build";
import type { LineSplitSegment } from "./visibility";

const T_EPS = 1e-7;
const SURFACE_EPS = 1e-5;
const UNIT_EPS = 1e-4;
const FACE_EPS = 1e-4;

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

function segmentOnSharedFrontFace(la: LocalCoords, lb: LocalCoords, k: number): boolean {
  const fa = localOnBoxFace(la);
  const fb = localOnBoxFace(lb);
  if (!fa || fa !== fb) return false;
  const faceId = BOX_FACE_TO_FACE_ID[fa];
  return faceId ? isFaceFrontFacing(faceId, k) : false;
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

export function viewDirectionLocal(k: number): LocalCoords {
  return { u: 1, v: -k, w: -k };
}

export function isFaceFrontFacing(faceId: string, k: number): boolean {
  const n = FACE_NORMALS[faceId];
  if (!n) return false;
  const vd = viewDirectionLocal(k);
  return dot(n, vd) < -SURFACE_EPS;
}

export function isBodyEdgeVisibleSchool(
  edgeId: string,
  _figure: ParallelepipedFigure,
  k: number,
): boolean {
  const pair = EDGE_FACES[edgeId];
  if (!pair) return true;
  return isFaceFrontFacing(pair[0], k) || isFaceFrontFacing(pair[1], k);
}

function inUnit(x: number): boolean {
  return x >= -UNIT_EPS && x <= 1 + UNIT_EPS;
}

/** Закрыта ли точка P=(u,v,w) поверхностью параллелепипеда (луч вдоль viewDirection). */
export function isPointOccludedLocal(local: LocalCoords, k: number): boolean {
  const { u, v, w } = local;
  const vd = viewDirectionLocal(k);

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
): { x: number; y: number; z: number } {
  const k = getViewK(view);
  const s = view.scale;
  const v = localToView(local, k);
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

function screenOverlapBreakpoints(
  originL: LocalCoords,
  dirL: LocalCoords,
  t0: number,
  t1: number,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): number[] {
  const bps: number[] = [];
  const p0 = projectLocalForScreen(
    {
      u: originL.u + t0 * dirL.u,
      v: originL.v + t0 * dirL.v,
      w: originL.w + t0 * dirL.w,
    },
    view,
  );
  const p1 = projectLocalForScreen(
    {
      u: originL.u + t1 * dirL.u,
      v: originL.v + t1 * dirL.v,
      w: originL.w + t1 * dirL.w,
    },
    view,
  );

  for (const faceId of FRONT_FACE_IDS) {
    const face = faceById(figure, faceId);
    if (!face) continue;
    const quad = face.vertexIds
      .map((id) => {
        const pt = resolved.points.get(id);
        if (!pt) return null;
        return projectLocalForScreen(pt.local, view);
      })
      .filter(Boolean) as Array<{ x: number; y: number; z: number }>;
    if (quad.length !== 4) continue;
    const clip = clipSegmentToQuad2D(p0.x, p0.y, p1.x, p1.y, quad);
    if (!clip) continue;
    const [lo, hi] = clip;
    bps.push(t0 + lo * (t1 - t0));
    bps.push(t0 + hi * (t1 - t0));
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
  const k = getViewK(view);
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

  const bps = [
    ...facePlaneBreakpointsLocal(originL, dirL, t0, t1),
    ...screenOverlapBreakpoints(originL, dirL, t0, t1, figure, resolved, view),
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
    const visible =
      segmentOnSharedFrontFace(lAt, lBt, k) || !isPointOccludedLocal(midL, k);
    segments.push({
      a: add(originWorld, scale(dirWorld, ta)),
      b: add(originWorld, scale(dirWorld, tb)),
      visible,
    });
  }

  if (!segments.length) {
    const midL: LocalCoords = {
      u: originL.u + ((t0 + t1) * 0.5) * dirL.u,
      v: originL.v + ((t0 + t1) * 0.5) * dirL.v,
      w: originL.w + ((t0 + t1) * 0.5) * dirL.w,
    };
    return [
      {
        a: add(originWorld, scale(dirWorld, t0)),
        b: add(originWorld, scale(dirWorld, t1)),
        visible: !isPointOccludedLocal(midL, k),
      },
    ];
  }

  return mergeAdjacent(segments);
}

export { FRONT_FACE_IDS, EDGE_FACES };
