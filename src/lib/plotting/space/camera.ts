import type { SpaceViewParams, Vec3 } from "./types";

export interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  world: Vec3;
}

function rotateY(p: Vec3, yaw: number): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

function rotateX(p: Vec3, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

/** Ортографическая проекция после поворота вида. depth — для проверки видимости. */
export function projectPoint(world: Vec3, view: SpaceViewParams): ProjectedPoint {
  let p = rotateY(world, view.yaw);
  p = rotateX(p, view.pitch);
  return {
    x: p.x * view.scale,
    y: -p.z * view.scale,
    depth: p.y,
    world,
  };
}

export const DEFAULT_SPACE_VIEW: SpaceViewParams = {
  scale: 120,
  yaw: 0.42,
  pitch: 0.38,
};

/** Направление наблюдателя в мировых координатах (единичный вектор). */
export function viewDirection(view: SpaceViewParams): Vec3 {
  const forward = { x: 0, y: 1, z: 0 };
  let p = rotateX(forward, -view.pitch);
  p = rotateY(p, -view.yaw);
  const l = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: p.x / l, y: p.y / l, z: p.z / l };
}
