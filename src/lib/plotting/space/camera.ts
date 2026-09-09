import type { LocalCoords, SpaceViewParams, Vec3 } from "./types";

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Глубина Z: меньше = ближе к наблюдателю. */
  depth: number;
  world: Vec3;
}

/** Фиксированная константа школьной проекции. */
export const VIEW_K = 0.28;

export function getViewK(view: SpaceViewParams): number {
  return view.depthSkewX ?? VIEW_K;
}

/** Локальные (u,v,w) → координаты вида (X,Y,Z). */
export function localToView(local: LocalCoords, k = VIEW_K): { x: number; y: number; z: number } {
  const { u, v, w } = local;
  return {
    x: v + k * u,
    y: w + k * u,
    z: u - k * v - k * w,
  };
}

/** Направление луча наблюдения (от наблюдателя вглубь сцены) в локальных координатах. */
export function viewDirectionLocal(k = VIEW_K): LocalCoords {
  return { u: 1, v: -k, w: -k };
}

/**
 * Школьная косоугольная проекция:
 * AD → вправо, AA₁ → вверх, AB → вглубь (вправо-вверх).
 */
export function projectLocal(local: LocalCoords, view: SpaceViewParams): ProjectedPoint {
  const k = getViewK(view);
  const s = view.scale;
  const { x, y, z } = localToView(local, k);
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
): ProjectedPoint {
  const p = projectLocal(local, view);
  return { ...p, world };
}

export const DEFAULT_SPACE_VIEW: SpaceViewParams = {
  scale: 1,
  yaw: 0,
  pitch: 0,
  depthSkewX: VIEW_K,
  depthSkewY: -VIEW_K,
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
  const k = VIEW_K;
  const l = Math.hypot(1, k, k) || 1;
  return { x: 1 / l, y: -k / l, z: -k / l };
}
