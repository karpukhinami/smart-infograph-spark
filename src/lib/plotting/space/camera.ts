import type {
  LocalCoords,
  ParallelepipedConstraints,
  ParallelepipedFigure,
  SpaceAppearance,
  SpaceSceneData,
  SpaceViewParams,
  Vec3,
} from "./types";

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
  /** Фазовый сдвиг A→B на эллипсе (параметрический), рад. */
  phi0: number;
  /** Горизонтальная полуось эллипса (большая), = ½·AD. */
  rx: number;
  /** Вертикальная полуось эллипса. */
  ry: number;
  /** Центр эллипса (X). */
  ox: number;
  /** Центр эллипса (Y). */
  oy: number;
  /** @deprecated угол A = π при t=0 */
  alpha: number;
}

/** Фиксированная константа школьной проекции (legacy). */
export const VIEW_K = 0.28;

/** Визуальная длина AB: половина AD. */
export const DEFAULT_DEPTH_LENGTH = 0.5;

/** Допуск «липкого» возврата ползунка поворота к 0°, градусы. */
export const YAW_SNAP_DEG = 4;

/** Визуальная длина AD (передняя глубина основания). */
export const DEFAULT_AD_LENGTH = 1;

/** Визуальная длина единичного ребра AA₁ на чертеже. */
export const DEFAULT_HEIGHT_LENGTH = 1.35;

/** Доля высоты холста под фигуру (вертикаль AA₁ ≈ 2/3). */
export const SPACE_FIT_HEIGHT_FRACTION = 2 / 3;

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

  const abLen = view.depthLength ?? DEFAULT_DEPTH_LENGTH;
  const adLen = DEFAULT_AD_LENGTH;
  const kxView = abLen * Math.cos(depthAngleRad);
  const kyView = abLen * Math.sin(depthAngleRad);

  const heightScreenX = heightLength * Math.cos(heightAngleRad);
  const heightScreenY = heightLength * Math.sin(heightAngleRad);

  // Центрированный эллипс с горизонтальной большой осью:
  // центр (adLen/2, 0), rx = adLen/2; при t=0: A=(0,0), D=(adLen,0), B на эллипсе.
  const ox = adLen / 2;
  const oy = 0;
  const rx = adLen / 2;
  const cosPhi0 = Math.max(-1, Math.min(1, 1 - (2 * kxView) / adLen));
  const phi0 = Math.acos(cosPhi0);
  const sinPhi0 = Math.sin(phi0);
  const ry = Math.abs(sinPhi0) > 1e-8 ? kyView / sinPhi0 : kyView;

  return {
    kx: kxView / scaleX,
    ky: kyView / scaleY,
    kwx: heightScreenX / scaleX,
    kwy: heightScreenY / scaleY,
    yawRad: (normalizeYawDeg(view.yaw) * Math.PI) / 180,
    phi0,
    rx,
    ry,
    ox,
    oy,
    alpha: Math.PI,
  };
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

function centeredEllipsePoint(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number,
): { x: number; y: number } {
  return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
}

/** A, B, D нижнего основания на эллипсе при параметре t (= yawRad). */
function baseCorners(
  t: number,
  phi0: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): { a: { x: number; y: number }; b: { x: number; y: number }; d: { x: number; y: number } } {
  const thetaA = Math.PI + t;
  const thetaB = thetaA - phi0;
  const thetaD = t;
  return {
    a: centeredEllipsePoint(cx, cy, rx, ry, thetaA),
    b: centeredEllipsePoint(cx, cy, rx, ry, thetaB),
    d: centeredEllipsePoint(cx, cy, rx, ry, thetaD),
  };
}

/** Точки эллипса вращения для отрисовки (координаты вида до fit). */
export function sampleRotationEllipse(
  coeffs: ProjectionCoeffs,
  segments = 64,
): Array<{ x: number; y: number }> {
  const { ox, oy, rx, ry } = coeffs;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= segments; i += 1) {
    const ang = (i / segments) * Math.PI * 2;
    pts.push({ x: ox + rx * Math.cos(ang), y: oy + ry * Math.sin(ang) });
  }
  return pts;
}

/**
 * Локальные (u,v,w) → координаты вида (X,Y,Z).
 * Основание — параллелограмм на центрированном эллипсе; w — вертикально без поворота.
 */
export function localToView(
  local: LocalCoords,
  coeffs: ProjectionCoeffs,
): { x: number; y: number; z: number } {
  const { u, v, w } = local;
  const { kx, ky, kwx, kwy, yawRad, phi0, ox, oy, rx, ry } = coeffs;
  const kw = kwySafe(kwy);
  const { a, b, d } = baseCorners(yawRad, phi0, ox, oy, rx, ry);
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

/**
 * Точки для фиксированного fit: эллипс + все вершины при полном обороте.
 * Не зависит от текущего yaw — картинка не «прыгает» при вращении.
 */
export function collectReferenceFitPoints(
  figure: ParallelepipedFigure,
  view: SpaceViewParams,
  constraints: ParallelepipedConstraints,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const baseCoeffs = getProjectionCoeffs({ ...view, yaw: 0 }, constraints);

  for (const p of sampleRotationEllipse(baseCoeffs)) {
    pts.push({ x: p.x * view.scale, y: -p.y * view.scale });
  }

  const yawSteps = 24;
  for (let i = 0; i < yawSteps; i += 1) {
    const yawDeg = (i / yawSteps) * 360;
    const coeffs = getProjectionCoeffs({ ...view, yaw: yawDeg }, constraints);
    for (const v of figure.vertices) {
      const pr = projectLocal(v.local, view, coeffs);
      pts.push({ x: pr.x, y: pr.y });
    }
  }
  return pts;
}

/** Вычисляет и возвращает зафиксированный fit для сцены. */
export function computeSpaceViewFit(
  data: SpaceSceneData,
  appearance: SpaceAppearance,
): Pick<SpaceViewParams, "fitScale" | "fitCx" | "fitCy"> | null {
  if (!data.figure) return null;
  const pts = collectReferenceFitPoints(data.figure, data.view, data.figure.constraints);
  const fit = fitSpaceProjection(pts, appearance.width, appearance.height, appearance.padding);
  return { fitScale: fit.scale, fitCx: fit.cx, fitCy: fit.cy };
}

/** Fit для вкладки «Пространство»: высота ≈ 2/3 холста, низ у нижнего края. */
export function fitSpaceProjection(
  projected: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  padding: number,
  heightFraction = SPACE_FIT_HEIGHT_FRACTION,
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
  const targetH = (height - padding * 2) * heightFraction;
  let scale = targetH / bh;
  scale = Math.min(scale, (availW / bw) * 0.96);
  const cx = width / 2 - ((minX + maxX) / 2) * scale;
  const cy = height - padding - maxY * scale;
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
