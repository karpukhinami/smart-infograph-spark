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
  kx: number;
  ky: number;
}

/** Фиксированная константа школьной проекции (legacy). */
export const VIEW_K = 0.28;

/** Визуальная длина единичного глубинного ребра AB при angle ≈ 45° (kx = ky = VIEW_K). */
export const DEFAULT_DEPTH_LENGTH = VIEW_K * Math.SQRT2;

/** @deprecated используйте getProjectionCoeffs */
export function getViewKu(view: SpaceViewParams): number {
  return view.depthSkewX ?? VIEW_K;
}

/** @deprecated используйте getProjectionCoeffs */
export function getViewKv(view: SpaceViewParams): number {
  return Math.abs(view.depthSkewY ?? VIEW_K);
}

/** @deprecated */
export function getViewK(view: SpaceViewParams): number {
  return getViewKu(view);
}

/** Визуальный угол между AD (вправо) и AB на чертеже, градусы. */
export function projectionAngleDeg(constraints: ParallelepipedConstraints): number {
  if (constraints.rectangular) return 90;
  return Math.min(60, Math.max(10, constraints.badAngleDeg ?? 45));
}

/**
 * kx, ky из угла и фиксированной depthLength.
 * AD не затрагивается: X = v + kx·u; глубина AB задаётся (depthScreenX, depthScreenY).
 */
export function getProjectionCoeffs(
  view: SpaceViewParams,
  constraints: ParallelepipedConstraints,
): ProjectionCoeffs {
  const angleRad = (projectionAngleDeg(constraints) * Math.PI) / 180;
  const depthLength = view.depthLength ?? DEFAULT_DEPTH_LENGTH;
  const scaleX = view.scaleX ?? view.scale;
  const scaleY = view.scaleY ?? view.scale;
  const depthScreenX = depthLength * Math.cos(angleRad);
  const depthScreenY = depthLength * Math.sin(angleRad);
  return {
    kx: depthScreenX / scaleX,
    ky: depthScreenY / scaleY,
  };
}

/**
 * Локальные (u,v,w) → координаты вида (X,Y,Z).
 * X = v + kx·u; Y = w + ky·u; Z = u - kx·v - ky·w.
 */
export function localToView(
  local: LocalCoords,
  { kx, ky }: ProjectionCoeffs,
): { x: number; y: number; z: number } {
  const { u, v, w } = local;
  return {
    x: v + kx * u,
    y: w + ky * u,
    z: u - kx * v - ky * w,
  };
}

/** Направление луча наблюдения в локальных (u,v,w). */
export function viewDirectionLocal({ kx, ky }: ProjectionCoeffs): LocalCoords {
  return { u: 1, v: -kx, w: -ky };
}

/**
 * Школьная косоугольная проекция:
 * AD → вправо, AA₁ → вверх, AB → по (kx, ky).
 */
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
