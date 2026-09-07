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

/** Базис AB, AD, AA₁ — школьная кабинетная проекция. */
export function computeBasis(constraints: ParallelepipedConstraints): {
  e1: Vec3;
  e2: Vec3;
  e3: Vec3;
} {
  const L = 1.1;
  if (constraints.rectangular && constraints.equilateral) {
    return { e1: vec3(0, -L, 0), e2: vec3(L, 0, 0), e3: vec3(0, 0, L) };
  }
  if (constraints.rectangular) {
    return { e1: vec3(0, -L, 0), e2: vec3(L * 1.15, 0, 0), e3: vec3(0, 0, L * 0.95) };
  }
  if (constraints.equilateral) {
    const e1 = vec3(0, -L, 0);
    const e2 = vec3(L, 0, 0);
    const e3 = vec3(0, 0, L);
    return { e1, e2, e3 };
  }
  return { e1: vec3(0, -L, 0), e2: vec3(L * 1.15, 0, 0), e3: vec3(0, 0, L * 0.95) };
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

export function pointOnLineParam(a: Vec3, b: Vec3, t: number): Vec3 {
  return lerp(a, b, t);
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
