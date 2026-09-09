import type { LocalCoords, ParallelepipedConstraints, SpaceViewParams, Vec3 } from "./types";

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Глубина Z: меньше = ближе к наблюдателю. */
  depth: number;
  world: Vec3;
}

export type ViewBasis = { e1: Vec3; e2: Vec3; e3: Vec3 };

export interface ProjectionCoeffs {
  /** Глубина: компонента u → экран X. */
  kx: number;
  /** Глубина: компонента u → экран Y. */
  ky: number;
  /** Высота: компонента w → экран X. */
  kwx: number;
  /** Высота: компонента w → экран Y. */
  kwy: number;
  /** Параметр t вращения вокруг вертикальной оси, рад. */
  yawRad: number;
  /** Фазовый сдвиг A→B на эллипсе основания, рад (∠BAD). */
  phi0: number;
  /** Горизонтальная полуось эллипса основания. */
  rx: number;
  /** Вертикальная полуось эллипса основания. */
  ry: number;
}

/** Фиксированная константа школьной проекции (legacy). */
export const VIEW_K = 0.28;

/** Визуальная длина единичного глубинного ребра AB при angle ≈ 45° (kx = ky = VIEW_K). */
export const DEFAULT_DEPTH_LENGTH = VIEW_K * Math.SQRT2;

/** Визуальная длина единичного ребра AA₁ на чертеже (как AD). */
export const DEFAULT_HEIGHT_LENGTH = 1;

/** Угол AA₁ относительно AD на чертеже при непрямоугольной проекции. */
export const OBLIQUE_HEIGHT_ANGLE_DEG = 75;

/** @deprecated */
export function getViewKu(view: SpaceViewParams): number {
  return view.depthSkewX ?? VIEW_K;
}

/** @deprecated */
export function getViewKv(view: SpaceViewParams): number {
  return Math.abs(view.depthSkewY ?? VIEW_K);
}

/** @deprecated */
export function getViewK(view: SpaceViewParams): number {
  return getViewKu(view);
}

/** Визуальный угол между AD (вправо) и AB на чертеже, градусы. */
export function projectionDepthAngleDeg(constraints: ParallelepipedConstraints): number {
  return Math.min(60, Math.max(10, constraints.badAngleDeg ?? 35));
}

/**
 * Угол AA₁ относительно AD на чертеже: 90° (вертикально) или наклон (75°).
 * Не влияет на 3D-геометрию.
 */
export function projectionHeightAngleDeg(constraints: ParallelepipedConstraints): number {
  return constraints.rectangular ? 90 : OBLIQUE_HEIGHT_ANGLE_DEG;
}

/**
 * kx, ky — наклон глубинных рёбер AB;
 * kwx, kwy — направление AA₁ на чертеже (зависит от «Прямоугольный»).
 */
export function getProjectionCoeffs(
  view: SpaceViewParams,
  constraints: ParallelepipedConstraints,
): ProjectionCoeffs {
  const depthAngleRad = (projectionDepthAngleDeg(constraints) * Math.PI) / 180;
  const heightAngleRad = (projectionHeightAngleDeg(constraints) * Math.PI) / 180;
  const depthLength = view.depthLength ?? DEFAULT_DEPTH_LENGTH;
  const heightLength = view.heightLength ?? DEFAULT_HEIGHT_LENGTH;
  const scaleX = view.scaleX ?? view.scale;
  const scaleY = view.scaleY ?? view.scale;

  const depthScreenX = depthLength * Math.cos(depthAngleRad);
  const depthScreenY = depthLength * Math.sin(depthAngleRad);
  const heightScreenX = heightLength * Math.cos(heightAngleRad);
  const heightScreenY = heightLength * Math.sin(heightAngleRad);

  const kx = depthScreenX / scaleX;
  const ky = depthScreenY / scaleY;
  const cosP = Math.cos(depthAngleRad);
  const sinP = Math.sin(depthAngleRad);
  const denom = cosP - 1;
  const rx = Math.abs(denom) > 1e-8 ? kx / denom : -DEFAULT_DEPTH_LENGTH;
  const ry = Math.abs(sinP) > 1e-8 ? -ky / sinP : DEFAULT_DEPTH_LENGTH;

  return {
    kx,
    ky,
    kwx: heightScreenX / scaleX,
    kwy: heightScreenY / scaleY,
    yawRad: (view.yaw * Math.PI) / 180,
    phi0: depthAngleRad,
    rx,
    ry,
  };
}

function kwySafe(kwy: number): number {
  return Math.abs(kwy) > 1e-9 ? kwy : 1;
}

/** Точка на эллипсе основания: A при t=0 в начале координат. */
function ellipseBasePoint(t: number, phase: number, rx: number, ry: number): { x: number; y: number } {
  const ang = t + phase;
  return {
    x: rx * (Math.cos(ang) - 1),
    y: ry * Math.sin(ang),
  };
}

/** Углы A, B, D нижнего основания на эллипсе при параметре t. */
function baseCorners(
  t: number,
  phi0: number,
  rx: number,
  ry: number,
): { a: { x: number; y: number }; b: { x: number; y: number }; d: { x: number; y: number } } {
  return {
    a: ellipseBasePoint(t, 0, rx, ry),
    b: ellipseBasePoint(t, -phi0, rx, ry),
    d: ellipseBasePoint(t, -phi0 + Math.PI, rx, ry),
  };
}

/**
 * Локальные (u,v,w) → координаты вида (X,Y,Z).
 * Основание — параллелограмм на эллипсе; AA₁ — линейное смещение по w.
 */
export function localToView(
  local: LocalCoords,
  { kx, ky, kwx, kwy, yawRad, phi0, rx, ry }: ProjectionCoeffs,
): { x: number; y: number; z: number } {
  const { u, v, w } = local;
  const { a, b, d } = baseCorners(yawRad, phi0, rx, ry);
  const kw = kwySafe(kwy);
  const ct = Math.cos(yawRad);
  const st = Math.sin(yawRad);
  const ur = u * ct - v * st;
  const vr = u * st + v * ct;
  return {
    x: a.x + u * (b.x - a.x) + v * (d.x - a.x) + kwx * w,
    y: a.y + u * (b.y - a.y) + v * (d.y - a.y) + kwy * w,
    z: ur - kx * vr - (ky / kw) * w,
  };
}

/** Направление луча наблюдения в локальных (u,v,w). */
export function viewDirectionLocal({ kx, ky, kwx, kwy, yawRad }: ProjectionCoeffs): LocalCoords {
  const kw = kwySafe(kwy);
  const vBase = -kx + (kwx * ky) / kw;
  const ct = Math.cos(yawRad);
  const st = Math.sin(yawRad);
  return {
    u: ct - st * vBase,
    v: st + ct * vBase,
    w: -ky / kw,
  };
}

export function projectLocal(
  local: LocalCoords,
  view: SpaceViewParams,
  coeffs: ProjectionCoeffs,
): ProjectedPoint {
  const s = view.scale;
  const { x, y, z } = localToView(local, coeffs);
  return {
    x: x * s,
    y: -y * s,
    depth: z,
    world: { x: 0, y: 0, z: 0 },
  };
}

export function projectFromLocalCoeffs(
  local: LocalCoords,
  world: Vec3,
  view: SpaceViewParams,
  coeffs: ProjectionCoeffs,
): ProjectedPoint {
  const p = projectLocal(local, view, coeffs);
  return { ...p, world };
}

export const DEFAULT_SPACE_VIEW: SpaceViewParams = {
  scale: 1,
  yaw: 0,
  pitch: 0,
  depthSkewX: VIEW_K,
  depthSkewY: VIEW_K,
  depthLength: DEFAULT_DEPTH_LENGTH,
  heightLength: DEFAULT_HEIGHT_LENGTH,
  visibilityMode: "school",
};

export function fitProjection(
  projected: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  padding: number,
): { scale: number; cx: number; cy: number } {
  if (!projected.length) return { scale: 1, cx: width / 2, cy: height / 2 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of projected) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const availW = width - padding * 2;
  const availH = height - padding * 2;
  const scale = Math.min(availW / bw, availH / bh) * 0.96;
  const cx = width / 2 - ((minX + maxX) / 2) * scale;
  const cy = height / 2 - ((minY + maxY) / 2) * scale;
  return { scale, cx, cy };
}

/** @deprecated */
export function projectPoint(world: Vec3, view: SpaceViewParams): ProjectedPoint {
  return {
    x: world.x * view.scale,
    y: -world.z * view.scale,
    depth: world.y,
    world,
  };
}

/** @deprecated */
export function viewDirection(_view: SpaceViewParams): Vec3 {
  const ku = VIEW_K;
  const kv = VIEW_K;
  const l = Math.hypot(1, ku, kv) || 1;
  return { x: 1 / l, y: -ku / l, z: -kv / l };
}
