import type { LocalCoords, SpaceViewParams, Vec3 } from "./types";

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Глубина в системе наблюдателя: больше = дальше от камеры. */
  depth: number;
  world: Vec3;
}
const DEPTH_V_WEIGHT = 0.12;
const DEPTH_W_WEIGHT = 0.06;

function depthSkewX(view: SpaceViewParams): number {
  return view.depthSkewX ?? view.oblique ?? 0.25;
}

function depthSkewY(view: SpaceViewParams): number {
  return view.depthSkewY ?? -(view.oblique ?? 0.25) * 0.55;
}

/**
 * Школьная аксонометрия: три базисных направления имеют разные экранные проекции.
 * e1=AB → вглубь (вправо+вверх), e2=AD → вправо, e3=AA₁ → вверх.
 * Вершины = origin + u·depth + v·right + w·up.
 */
export function projectLocal(local: LocalCoords, view: SpaceViewParams): ProjectedPoint {
  const s = view.scale;
  const dx = depthSkewX(view);
  const dy = depthSkewY(view);
  const x = s * (local.v + local.u * dx);
  const y = s * (local.u * dy - local.w);
  const depth = local.u + local.v * DEPTH_V_WEIGHT + local.w * DEPTH_W_WEIGHT;
  return {
    x,
    y,
    depth,
    world: { x: 0, y: 0, z: 0 },
  };
}

/** Проекция 3D-точки через локальные коэффициенты (геометрия → вид → экран). */
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
  depthSkewX: 0.25,
  depthSkewY: -0.15,
};

/** @deprecated используйте projectFromLocalCoeffs */
export function projectPoint(world: Vec3, view: SpaceViewParams): ProjectedPoint {
  return {
    x: world.x * view.scale,
    y: -world.z * view.scale,
    depth: world.y,
    world,
  };
}

/** Подобрать масштаб и центр, чтобы фигура занимала большую часть полотна. */
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

/** Направление к наблюдателю (для устаревших вызовов). */
export function viewDirection(_view: SpaceViewParams): Vec3 {
  return normalizeVec({ x: -0.4, y: 0.85, z: -0.35 });
}

function normalizeVec(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
