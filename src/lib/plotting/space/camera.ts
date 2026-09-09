import {
  buildRotationEllipse,
  ellipsePoint,
  sampleConicEllipse,
  type ConicEllipse,
} from "./conic-ellipse";
import { isParallelepiped, isPyramid } from "./figure";
import { ellipseBaseVerticesEqualArc } from "./pyramid";
import type {
  LocalCoords,
  ParallelepipedConstraints,
  PyramidFigure,
  SpaceAppearance,
  SpaceFigure,
  SpaceFigureConstraints,
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
  /** Эллипс вращения (коника через 4 вершины + 5-я точка). */
  orbit: ConicEllipse;
  /** Фазовый сдвиг A→B на эллипсе (θ_A − θ_B), рад. */
  phi0: number;
  /** @deprecated большая полуось эллипса */
  rx: number;
  /** @deprecated малая полуось эллипса */
  ry: number;
  /** @deprecated центр эллипса (X) */
  ox: number;
  /** @deprecated центр эллипса (Y) */
  oy: number;
  /** @deprecated угол A = π при t=0 */
  alpha: number;
}

/** Фиксированная константа школьной проекции (legacy). */
export const VIEW_K = 0.28;

/** Визуальная длина AB: половина AD. */
export const DEFAULT_DEPTH_LENGTH = 0.875;

/** Допуск «липкого» возврата ползунка поворота к 0°, градусы. */
export const YAW_SNAP_DEG = 4;

/** Визуальная длина AD (передняя глубина основания): базовая × (1 + 3/4). */
export const DEFAULT_AD_LENGTH = 1.75;

/** Визуальная длина единичного ребра AA₁ на чертеже. */
export const DEFAULT_HEIGHT_LENGTH = 1.35;

/** Доля высоты холста под фигуру (вертикаль AA₁ ≈ 2/3). */
export const SPACE_FIT_HEIGHT_FRACTION = 2 / 3;

/** Доля ширины холста под фигуру (параллелограмм максимально широкий). */
export const SPACE_FIT_WIDTH_FRACTION = 0.94;

/** Дополнительный отступ снизу (доля высоты холста): основание выше нижнего края. */
export const SPACE_FIT_BOTTOM_INSET_FRACTION = 0.1;

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
export function projectionDepthAngleDeg(constraints: SpaceFigureConstraints): number {
  return Math.min(60, Math.max(10, constraints.badAngleDeg ?? 35));
}

/**
 * Угол AA₁ относительно AD на чертеже: 90° (вертикально) или наклон (75°).
 * Не влияет на 3D-геометрию.
 */
export function projectionHeightAngleDeg(constraints: SpaceFigureConstraints): number {
  if ("rectangular" in constraints) return constraints.rectangular ? 90 : OBLIQUE_HEIGHT_ANGLE_DEG;
  return 90;
}

/**
 * kx, ky — наклон глубинных рёбер AB;
 * kwx, kwy — направление AA₁ на чертеже (зависит от «Прямоугольный»).
 */
export function getProjectionCoeffs(view: SpaceViewParams, figure: SpaceFigure): ProjectionCoeffs {
  const constraints = figure.constraints;
  const depthAngleRad = (projectionDepthAngleDeg(constraints) * Math.PI) / 180;
  const heightAngleRad = (projectionHeightAngleDeg(constraints) * Math.PI) / 180;
  const heightLength = view.heightLength ?? DEFAULT_HEIGHT_LENGTH;
  const scaleX = view.scaleX ?? view.scale;
  const scaleY = view.scaleY ?? view.scale;

  const adLen = DEFAULT_AD_LENGTH;
  const abLen = adLen / 2;
  const kxView = abLen * Math.cos(depthAngleRad);
  const kyView = abLen * Math.sin(depthAngleRad);

  const heightScreenX = heightLength * Math.cos(heightAngleRad);
  const heightScreenY = heightLength * Math.sin(heightAngleRad);

  const orbit =
    buildRotationEllipse(kxView, kyView, adLen) ??
    fallbackRotationEllipse(kxView, kyView, adLen);
  const phi0 = orbit.thetaA - orbit.thetaB;

  return {
    kx: kxView / scaleX,
    ky: kyView / scaleY,
    kwx: heightScreenX / scaleX,
    kwy: heightScreenY / scaleY,
    yawRad: isPyramid(figure) ? 0 : (normalizeYawDeg(view.yaw) * Math.PI) / 180,
    orbit,
    phi0,
    rx: orbit.a,
    ry: orbit.b,
    ox: orbit.cx,
    oy: orbit.cy,
    alpha: Math.PI,
  };
}

/** Запасной эллипс с центром в O, если подгонка не удалась. */
function fallbackRotationEllipse(kx: number, ky: number, adLen: number): ConicEllipse {
  const cx = (adLen + kx) / 2;
  const cy = ky / 2;
  const cosPhi0 = Math.max(-1, Math.min(1, 1 - (2 * kx) / adLen));
  const phi0 = Math.acos(cosPhi0);
  const sinPhi0 = Math.sin(phi0);
  const a = adLen / 2;
  const b = Math.abs(sinPhi0) > 1e-8 ? Math.abs(ky / 2 / sinPhi0) : Math.abs(ky / 2);
  const thetaA = Math.PI;
  const thetaB = thetaA - phi0;
  const thetaD = thetaB + Math.PI;
  return { cx, cy, a, b, psi: 0, thetaA, thetaB, thetaD };
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

/** A, B, D нижнего основания на эллипсе при параметре t (= yawRad). */
function baseCorners(
  orbit: ConicEllipse,
  yawRad: number,
): { a: { x: number; y: number }; b: { x: number; y: number }; d: { x: number; y: number } } {
  return {
    a: ellipsePoint(orbit, orbit.thetaA + yawRad),
    b: ellipsePoint(orbit, orbit.thetaB + yawRad),
    d: ellipsePoint(orbit, orbit.thetaD + yawRad),
  };
}

/** Точки эллипса вращения для отрисовки (координаты вида до fit). */
export function sampleRotationEllipse(
  coeffs: ProjectionCoeffs,
  segments = 64,
): Array<{ x: number; y: number }> {
  return sampleConicEllipse(coeffs.orbit, segments);
}

function pyramidScreenBase(figure: PyramidFigure, coeffs: ProjectionCoeffs): Array<{ x: number; y: number }> {
  const n = figure.baseLabels.length;
  return ellipseBaseVerticesEqualArc(coeffs.orbit, n, coeffs.orbit.thetaA);
}

/** Аффинно: A + u·(B−A) + v·(last−A) на экране — согласовано с 3D-базисом. */
function pyramidBaseAt(
  u: number,
  v: number,
  baseScr: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  const a = baseScr[0] ?? { x: 0, y: 0 };
  const b = baseScr[1] ?? a;
  const last = baseScr[baseScr.length - 1] ?? a;
  return {
    x: a.x + u * (b.x - a.x) + v * (last.x - a.x),
    y: a.y + u * (b.y - a.y) + v * (last.y - a.y),
  };
}

function pyramidLocalToView(
  local: LocalCoords,
  coeffs: ProjectionCoeffs,
  figure: PyramidFigure,
): { x: number; y: number; z: number } {
  const { kwx, kwy, kx, ky, orbit } = coeffs;
  const kw = kwySafe(kwy);
  const n = figure.baseLabels.length;
  const baseScr = pyramidScreenBase(figure, coeffs);
  const apexAnchor = figure.constraints.apexOnCenter
    ? { x: orbit.cx, y: orbit.cy }
    : baseScr[0]!;
  const atBase = pyramidBaseAt(local.u, local.v, baseScr);
  const w = local.w;
  return {
    x: atBase.x + w * (apexAnchor.x - atBase.x) + kwx * w,
    y: atBase.y + w * (apexAnchor.y - atBase.y) + kwy * w,
    z: local.u - kx * local.v - (ky / kw) * w,
  };
}

/**
 * Локальные (u,v,w) → координаты вида (X,Y,Z).
 */
export function localToView(
  local: LocalCoords,
  coeffs: ProjectionCoeffs,
  figure?: SpaceFigure,
): { x: number; y: number; z: number } {
  if (figure && isPyramid(figure)) return pyramidLocalToView(local, coeffs, figure);
  const { u, v, w } = local;
  const { kx, ky, kwx, kwy, yawRad, orbit } = coeffs;
  const kw = kwySafe(kwy);
  const { a, b, d } = baseCorners(orbit, yawRad);
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
  figure?: SpaceFigure,
): ProjectedPoint {
  const s = view.scale;
  const { x, y, z } = localToView(local, coeffs, figure);
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
  figure?: SpaceFigure,
): ProjectedPoint {
  const p = projectLocal(local, view, coeffs, figure);
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
  planeFillByDepth: false,
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
 * Точки для фиксированного fit: все вершины при полном обороте (без контура эллипса).
 * Не зависит от текущего yaw — картинка не «прыгает» при вращении.
 */
export function collectReferenceFitPoints(
  figure: SpaceFigure,
  view: SpaceViewParams,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const yawSteps = isPyramid(figure) ? 1 : 24;
  for (let i = 0; i < yawSteps; i += 1) {
    const yawDeg = isPyramid(figure) ? 0 : (i / yawSteps) * 360;
    const coeffs = getProjectionCoeffs({ ...view, yaw: yawDeg }, figure);
    for (const v of figure.vertices) {
      const pr = projectLocal(v.local, view, coeffs, figure);
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
  const pts = collectReferenceFitPoints(data.figure, data.view);
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
  const targetW = availW * SPACE_FIT_WIDTH_FRACTION;
  let scale = targetH / bh;
  scale = Math.min(scale, targetW / bw);
  const cx = width / 2 - ((minX + maxX) / 2) * scale;
  const bottomInset = (height - padding * 2) * SPACE_FIT_BOTTOM_INSET_FRACTION;
  const cy = height - padding - bottomInset - maxY * scale;
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
