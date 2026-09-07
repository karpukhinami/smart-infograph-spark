import type { SpaceViewParams, Vec3 } from "./types";

export interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  world: Vec3;
}

/** Кабинетная проекция: вертикали строго вверх, глубина — наклон вправо-вниз. */
export function projectPoint(world: Vec3, view: SpaceViewParams): ProjectedPoint {
  const depth = world.y;
  const x = (world.x - world.y * view.oblique) * view.scale;
  const y = -world.z * view.scale;
  return { x, y, depth, world };
}

export const DEFAULT_SPACE_VIEW: SpaceViewParams = {
  scale: 1,
  yaw: 0,
  pitch: 0,
  oblique: 0.42,
};

/** Направление от сцены к наблюдателю: спереди-справа-сверху (видны передняя, верхняя и правая грани). */
export function viewDirection(_view: SpaceViewParams): Vec3 {
  const v = { x: 0.4, y: -0.85, z: 0.35 };
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
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
