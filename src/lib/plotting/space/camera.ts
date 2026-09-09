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
  /** Горизонтальная полуось эллипса основания (большая). */
  rx: number;
  /** Вертикальная полуось эллипса основания. */
  ry: number;
  /** Центр эллипса основания (X). */
  ox: number;
  /** Центр эллипса основания (Y). */
  oy: number;
  /** Угол A на эллипсе при yaw=0, рад. */
  alpha: number;
}

/** Фиксированная константа школьной проекции (legacy). */
export const VIEW_K = 0.28;

/** Визуальная длина AB на чертеже: половина AD. */
export const DEFAULT_DEPTH_LENGTH = 0.5;

/** Допуск «липкого» возврата ползунка поворота к 0°, градусы. */
export const YAW_SNAP_DEG = 4;

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
  const heightLength = view.heightLength ?? DEFAULT_HEIGHT_LENGTH;
  const scaleX = view.scaleX ?? view.scale;
  const scaleY = view.scaleY ?? view.scale;

  // AB: длина = половина AD, угол ∠BAD от горизонтали AD.
  const abLen = view.depthLength ?? DEFAULT_DEPTH_LENGTH;
  const kx = (abLen * Math.cos(depthAngleRad)) / scaleX;
  const ky = (abLen * Math.sin(depthAngleRad)) / scaleY;
  const heightScreenX = heightLength * Math.cos(heightAngleRad);
  const heightScreenY = heightLength * Math.sin(heightAngleRad);

  const phi0 = depthAngleRad;
  const cosP = Math.cos(phi0);
  const sinP = Math.sin(phi0);
  const denom = cosP - 1;
  const rx = Math.abs(denom) > 1e-8 ? Math.abs(kx / denom) : oxFallback(kx);
  const ry = Math.abs(sinP) > 1e-8 ? Math.abs(ky / sinP) : rx;
  const ox = (1 + kx) / 2;
  const oy = ky / 2;

  return {
    kx,
    ky,
    kwx: heightScreenX / scaleX,
    kwy: heightScreenY / scaleY,
    yawRad: (normalizeYawDeg(view.yaw) * Math.PI) / 180,
    phi0,
    rx: Math.max(rx, ry),
    ry: Math.min(rx, ry),
    ox,
    oy,
    alpha: 0,
  };
}

function oxFallback(kx: number): number {
  return Math.max(0.5, (1 + kx) / 2);
}

/** Нормализует yaw в [0,360) с «липким» нулём. */
export function normalizeYawDeg(yaw: number): number {
  let y = ((yaw % 360) + 360) % 360;
  if (y <= YAW_SNAP_DEG || y >= 360 - YAW_SNAP_DEG) return 0;
  return y;
}

function kwySafe(kwy: number): number {
  return Math.abs(kwy) > 1e-9 ? kwy : 1;
}

/** Точки эллипса вращения для отрисовки (координаты вида до fit). */
export function sampleRotationEllipse(
  coeffs: ProjectionCoeffs,
  segments = 64,
): Array<{ x: number; y: number }> {
  const { rx, ry } = coeffs;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= segments; i += 1) {
    const ang = (i / segments) * Math.PI * 2;
    pts.push({ x: rx * Math.cos(ang) - rx, y: ry * Math.sin(ang) });
  }
  return pts;
}

/** Линейная проекция при yaw=0: AD горизонтально, AB под ∠BAD. */
function linearLocalToView(
  local: LocalCoords,
  { kx, ky, kwx, kwy }: ProjectionCoeffs,
): { x: number; y: number; z: number } {
  const { u, v, w } = local;
  const kw = kwySafe(kwy);
  return {
    x: v + kx * u + kwx * w,
    y: kwy * w + ky * u,
    z: u - kx * v - (ky / kw) * w,
  };
}

/**
 * Локальные (u,v,w) → координаты вида (X,Y,Z).
 * При yaw=0: AD горизонтально, AB = ½·AD под ∠BAD; иначе — вращение вокруг центра основания.
 */
export function localToView(
  local: LocalCoords,
  coeffs: ProjectionCoeffs,
): { x: number; y: number; z: number } {
  const { u, v, w } = local;
  const { kx, ky, kwx, kwy, yawRad, ox, oy } = coeffs;
  const kw = kwySafe(kwy);
  const baseLin = linearLocalToView({ u, v, w: 0 }, coeffs);

  let bx = baseLin.x;
  let by = baseLin.y;
  if (Math.abs(yawRad) >= 1e-12) {
    const ct = Math.cos(yawRad);
    const st = Math.sin(yawRad);
    const dx = baseLin.x - ox;
    const dy = baseLin.y - oy;
    bx = ox + dx * ct - dy * st;
    by = oy + dx * st + dy * ct;
  }

  const ct = Math.cos(yawRad);
  const st = Math.sin(yawRad);
  const ur = u * ct - v * st;
  const vr = u * st + v * ct;
  return {
    x: bx + kwx * w,
    y: by + kwy * w,
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
