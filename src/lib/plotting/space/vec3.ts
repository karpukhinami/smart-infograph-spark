import type { LocalCoords, ParallelepipedConstraints, Vec3 } from "./types";

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function dotLocal(a: LocalCoords, b: LocalCoords): number {
  return a.u * b.u + a.v * b.v + a.w * b.w;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function len(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalize(v: Vec3): Vec3 {
  const l = len(v);
  if (!(l > 1e-12)) return { x: 0, y: 0, z: 0 };
  return scale(v, 1 / l);
}

export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return add(a, scale(sub(b, a), t));
}

export function localToWorld(
  local: LocalCoords,
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 },
): Vec3 {
  return add(
    add(scale(basis.e1, local.u), scale(basis.e2, local.v)),
    scale(basis.e3, local.w),
  );
}

/** Базис e1=AB, e2=AD, e3=AA₁; основание всегда прямоугольное в 3D (∠BAD = 90°). */
export function computeBasis(constraints: ParallelepipedConstraints): {
  e1: Vec3;
  e2: Vec3;
  e3: Vec3;
} {
  const L = 1.1;
  const e1Len = L;
  const e2Len = constraints.equilateral ? L : L * 1.15;
  const e3Len = constraints.equilateral ? L : L * 0.95;

  const e1 = vec3(0, -e1Len, 0);
  const e2 = vec3(e2Len, 0, 0);
  const e3 = vec3(0, 0, e3Len);
  return { e1, e2, e3 };
}

export function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return normalize(cross(sub(b, a), sub(c, a)));
}

export interface PlaneEq {
  normal: Vec3;
  d: number;
}

export function planeFromPoints(a: Vec3, b: Vec3, c: Vec3): PlaneEq | null {
  const n = cross(sub(b, a), sub(c, a));
  if (len(n) < 1e-9) return null;
  const normal = normalize(n);
  return { normal, d: -dot(normal, a) };
}

export function planePointDistance(p: Vec3, plane: PlaneEq): number {
  return dot(plane.normal, p) + plane.d;
}

export function linePlaneIntersection(
  a: Vec3,
  b: Vec3,
  plane: PlaneEq,
): Vec3 | null {
  const dir = sub(b, a);
  const denom = dot(plane.normal, dir);
  if (Math.abs(denom) < 1e-9) return null;
  const t = -(dot(plane.normal, a) + plane.d) / denom;
  return add(a, scale(dir, t));
}

/** Прямая пересечения двух плоскостей: n·p + d = 0. */
export function intersectPlanes(
  pA: PlaneEq,
  pB: PlaneEq,
): { origin: Vec3; dir: Vec3 } | null {
  const dirRaw = cross(pA.normal, pB.normal);
  const dirLenSq = dot(dirRaw, dirRaw);
  if (dirLenSq < 1e-12) return null;
  const dir = normalize(dirRaw);
  const h1 = -pA.d;
  const h2 = -pB.d;
  const origin = scale(
    add(scale(cross(pB.normal, dirRaw), h1), scale(cross(dirRaw, pA.normal), h2)),
    1 / dirLenSq,
  );
  return { origin, dir };
}

export function segmentPlaneIntersection(
  a: Vec3,
  b: Vec3,
  plane: PlaneEq,
): Vec3 | null {
  const hit = linePlaneIntersection(a, b, plane);
  if (!hit) return null;
  const ab = sub(b, a);
  const t = len(ab) < 1e-9 ? 0 : dot(sub(hit, a), ab) / dot(ab, ab);
  if (t < -1e-6 || t > 1 + 1e-6) return null;
  return hit;
}

export function paramOnLine(a: Vec3, b: Vec3, p: Vec3): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-12) return 0;
  return dot(sub(p, a), ab) / l2;
}

/** Пересечение двух прямых в 3D (бесконечных); null — параллельны или скрещиваются. */
export function intersectLineLine3D(
  p1: Vec3,
  d1: Vec3,
  p2: Vec3,
  d2: Vec3,
  tol = 1e-5,
): Vec3 | null {
  const w0 = sub(p1, p2);
  const a = dot(d1, d1);
  const b = dot(d1, d2);
  const c = dot(d2, d2);
  const d = dot(d1, w0);
  const e = dot(d2, w0);
  const denom = a * c - b * b;
  if (Math.abs(denom) < 1e-12) return null;
  const t = (b * e - c * d) / denom;
  const s = (a * e - b * d) / denom;
  const on1 = add(p1, scale(d1, t));
  const on2 = add(p2, scale(d2, s));
  if (len(sub(on1, on2)) > tol) return null;
  return scale(add(on1, on2), 0.5);
}

export function distPointToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-12) return len(sub(p, a));
  let t = dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  return len(sub(p, add(a, scale(ab, t))));
}

export function distPointToLine(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a);
  const abLen = len(ab);
  if (abLen < 1e-12) return len(sub(p, a));
  return len(cross(sub(p, a), ab)) / abLen;
}

export function pointOnLineParam(a: Vec3, b: Vec3, t: number): Vec3 {
  return lerp(a, b, t);
}

/**
 * Отрезок прямой L(t) = o + t·d, попадающий в куб (u,v,w) ∈ [0,1]³.
 * t — параметр вдоль исходной прямой (тот же, что у carrier.origin + t·carrier.dir).
 */
export function clipLineToUnitCube(
  o: LocalCoords,
  d: LocalCoords,
  eps = 1e-9,
): { t0: number; t1: number } | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const axes: Array<[number, number]> = [
    [o.u, d.u],
    [o.v, d.v],
    [o.w, d.w],
  ];
  for (const [origin, delta] of axes) {
    if (Math.abs(delta) < eps) {
      if (origin < -eps || origin > 1 + eps) return null;
      continue;
    }
    let ta = (0 - origin) / delta;
    let tb = (1 - origin) / delta;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
  }
  if (t0 > t1 + eps) return null;
  return { t0, t1 };
}

/** Часть носителя прямой внутри параллелепипеда (локальные координаты ∈ [0,1]³). */
export function clipCarrierToUnitCube(
  carrier: { origin: Vec3; dir: Vec3 },
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 },
): { t0: number; t1: number } | null {
  const o0 = worldToLocal(carrier.origin, basis);
  if (!o0) return null;
  const o1 = worldToLocal(add(carrier.origin, carrier.dir), basis);
  if (!o1) return null;
  return clipLineToUnitCube(o0, {
    u: o1.u - o0.u,
    v: o1.v - o0.v,
    w: o1.w - o0.w,
  });
}

export function worldToLocal(
  world: Vec3,
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 },
): LocalCoords | null {
  const { e1, e2, e3 } = basis;
  const det =
    e1.x * (e2.y * e3.z - e2.z * e3.y) -
    e1.y * (e2.x * e3.z - e2.z * e3.x) +
    e1.z * (e2.x * e3.y - e2.y * e3.x);
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det;
  const u =
    (world.x * (e2.y * e3.z - e2.z * e3.y) -
      world.y * (e2.x * e3.z - e2.z * e3.x) +
      world.z * (e2.x * e3.y - e2.y * e3.x)) *
    inv;
  const v =
    (e1.x * (world.y * e3.z - world.z * e3.y) -
      e1.y * (world.x * e3.z - world.z * e3.x) +
      e1.z * (world.x * e3.y - world.y * e3.x)) *
    inv;
  const w =
    (e1.x * (e2.y * world.z - e2.z * world.y) -
      e1.y * (e2.x * world.z - e2.z * world.x) +
      e1.z * (e2.x * world.y - e2.y * world.x)) *
    inv;
  return { u, v, w };
}
