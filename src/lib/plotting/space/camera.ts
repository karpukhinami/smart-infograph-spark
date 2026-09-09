import type { LocalCoords, ParallelepipedConstraints, SpaceViewParams, Vec3 } from "./types";

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Глубина Z: меньше = ближе к наблюдателю. */
  depth: number;
  world: Vec3;
}

export type ViewBasis = { e1: Vec3; e2: Vec3; e3: Vec3 };

/** Фиксированная константа школьной проекции (глубина AB). */
export const VIEW_K = 0.28;

/** Горизонтальная доля AB на экране (смещение по X). */
export function getViewKu(view: SpaceViewParams): number {
  return view.depthSkewX ?? VIEW_K;
}

/** Вертикальная доля AB на экране (смещение по Y). */
export function getViewKv(view: SpaceViewParams): number {
  return Math.abs(view.depthSkewY ?? VIEW_K);
}

/** @deprecated используйте getViewKu */
export function getViewK(view: SpaceViewParams): number {
  return getViewKu(view);
}

/** Угол ∠BAD на чертеже в радианах (не влияет на 3D-геометрию). */
export function projectionBadAngleRad(constraints: ParallelepipedConstraints): number {
  const angleDeg = constraints.rectangular
    ? 90
    : Math.min(150, Math.max(30, constraints.badAngleDeg ?? 90));
  return (angleDeg * Math.PI) / 180;
}

/**
 * Локальные (u,v,w) → координаты вида (X,Y,Z).
 * AD горизонтален: X = v·sin(∠BAD) + ku·u; AA₁ вертикален: Y = w + kv·u.
 */
export function localToView(
  local: LocalCoords,
  view: SpaceViewParams,
  projectionAngleRad = Math.PI / 2,
): { x: number; y: number; z: number } {
  const ku = getViewKu(view);
  const kv = getViewKv(view);
  const { u, v, w } = local;
  return {
    x: v * Math.sin(projectionAngleRad) + ku * u,
    y: w + kv * u,
    z: u - ku * v - kv * w,
  };
}

/** Направление луча наблюдения в локальных (u,v,w). */
export function viewDirectionLocal(view: SpaceViewParams): LocalCoords {
  const ku = getViewKu(view);
  const kv = getViewKv(view);
  return { u: 1, v: -ku, w: -kv };
}

/**
 * Школьная косоугольная проекция:
 * AD → вправо, AA₁ → вверх, AB → вглубь (с коэффициентами ku, kv).
 */
export function projectLocal(
  local: LocalCoords,
  view: SpaceViewParams,
  projectionAngleRad = Math.PI / 2,
): ProjectedPoint {
  const s = view.scale;
  const { x, y, z } = localToView(local, view, projectionAngleRad);
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
  projectionAngleRad = Math.PI / 2,
): ProjectedPoint {
  const p = projectLocal(local, view, projectionAngleRad);
  return { ...p, world };
}

export const DEFAULT_SPACE_VIEW: SpaceViewParams = {
  scale: 1,
  yaw: 0,
  pitch: 0,
  depthSkewX: VIEW_K,
  depthSkewY: VIEW_K,
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
