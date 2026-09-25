import {
  buildRotationEllipse,
  ellipsePoint,
  sampleConicEllipse,
  type ConicEllipse,
} from "./conic-ellipse";
import { isParallelepiped, isPrism, isPyramid, isSchoolExtrusionFigure } from "./figure";
import {
  localToCartesian,
  pyramidApexScreenAnchor,
  pyramidBaseCartesianFromFigure,
  pyramidEllipseBaseScreen,
  pyramidHeight,
  pyramidObserverEyePosition,
  pyramidProjectOnApexGenerator,
} from "./pyramid";
import {
  prismHeight,
  prismProjectionPyramid,
  prismScreenBaseVertices,
  prismTopScreenOffset,
} from "./prism";
import type {
  LocalCoords,
  ParallelepipedConstraints,
  PrismFigure,
  PyramidFigure,
  SpaceAppearance,
  SpaceFigure,
  SpaceFigureConstraints,
  SpaceSceneData,
  PlaneFillDepthMode,
  SpaceViewParams,
  Vec3,
} from "./types";
import { add, dot, len, normalize, scale, sub, worldToLocal } from "./vec3";

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
    yawRad: (normalizeYawDeg(view.yaw) * Math.PI) / 180,
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

/** Нулевая ось экранной проекции: перемещение вдоль неё не меняет экранные X/Y. */
function affineProjectionDepthAxis(coeffs: ProjectionCoeffs): LocalCoords {
  const { kwx, kwy, yawRad, orbit } = coeffs;
  const { a, b, d } = baseCorners(orbit, yawRad);
  const xu = b.x - a.x;
  const xv = d.x - a.x;
  const yu = b.y - a.y;
  const yv = d.y - a.y;
  const axis = {
    u: xv * kwy - kwx * yv,
    v: kwx * yu - xu * kwy,
    w: xu * yv - xv * yu,
  };
  const axisLength = Math.hypot(axis.u, axis.v, axis.w) || 1;
  return { u: axis.u / axisLength, v: axis.v / axisLength, w: axis.w / axisLength };
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
  return pyramidEllipseBaseScreen(coeffs.orbit, figure.baseLabels.length, coeffs.yawRad);
}

/**
 * Глубина пирамиды: проекция world-точки на ось «центр тела → глаз наблюдателя»
 * (тот же «глаз» (4,4,1) с поворотом −yaw, что и у отладочных лучей обзора).
 * Это настоящая линейная функция world-координат — глобально согласованная для
 * сортировки заливок, — в отличие от прежнего варианта через центральную
 * проекцию на основание (нелинейно из-за деления на 1−t) и не учитывавшего yaw.
 * От абстрактной оси kx/ky (используется для параллелепипеда) она отличается
 * тем, что соответствует РЕАЛЬНОЙ точке обзора пирамиды, а не углу наклона
 * рёбер на чертеже — так порядок «дальше/ближе» совпадает с тем, что нарисовано
 * (сходящиеся к вершине S рёбра рассчитаны на взгляд именно из этой точки).
 */
function pyramidProjectionDepthAxis(
  coeffs: ProjectionCoeffs,
  figure: PyramidFigure,
): Vec3 {
  const { kwx, kwy } = coeffs;
  const H = pyramidHeight(figure.constraints);
  const baseCart = pyramidBaseCartesianFromFigure(figure);
  const baseScr = pyramidScreenBase(figure, coeffs);
  const a = baseCart[0];
  const b = baseCart[1];
  const c = baseCart[2];
  const sa = baseScr[0];
  const sb = baseScr[1];
  const sc = baseScr[2];
  if (!a || !b || !c || !sa || !sb || !sc) return { x: 0, y: 0, z: 1 };

  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const determinant = ux * vy - uy * vx;
  if (Math.abs(determinant) <= 1e-12) return { x: 0, y: 0, z: 1 };

  // Коэффициенты единого аффинного отображения world → screen.
  const sxu = sb.x - sa.x;
  const sxv = sc.x - sa.x;
  const syu = sb.y - sa.y;
  const syv = sc.y - sa.y;
  const rowX = {
    x: (sxu * vy - sxv * uy) / determinant,
    y: (-sxu * vx + sxv * ux) / determinant,
    z: H > 1e-9 ? kwx / H : 0,
  };
  const rowY = {
    x: (syu * vy - syv * uy) / determinant,
    y: (-syu * vx + syv * ux) / determinant,
    z: H > 1e-9 ? kwy / H : 0,
  };
  let axis = normalize({
    x: rowX.y * rowY.z - rowX.z * rowY.y,
    y: rowX.z * rowY.x - rowX.x * rowY.z,
    z: rowX.x * rowY.y - rowX.y * rowY.x,
  });
  const eye = pyramidObserverEyePosition(coeffs.yawRad);
  if (dot(axis, eye) < 0) axis = scale(axis, -1);
  return axis;
}

function pyramidCartesianDepth(
  world: Vec3,
  coeffs: ProjectionCoeffs,
  figure: PyramidFigure,
): number {
  const axis = pyramidProjectionDepthAxis(coeffs, figure);
  // Меньше = ближе к наблюдателю.
  return -dot(world, axis);
}

function pyramidWorldToView(
  world: Vec3,
  coeffs: ProjectionCoeffs,
  figure: PyramidFigure,
): { x: number; y: number; z: number } {
  const { kwx, kwy } = coeffs;
  const H = pyramidHeight(figure.constraints);
  const baseCart = pyramidBaseCartesianFromFigure(figure);
  const baseScr = pyramidScreenBase(figure, coeffs);
  const depth = pyramidCartesianDepth(world, coeffs, figure);
  const a = baseCart[0];
  const b = baseCart[1];
  const c = baseCart[2];
  const sa = baseScr[0];
  const sb = baseScr[1];
  const sc = baseScr[2];
  if (!a || !b || !c || !sa || !sb || !sc) return { x: 0, y: 0, z: depth };

  // Экранные вершины правильного основания лежат на одном эллипсе и потому
  // задаются единственным аффинным отображением его декартовой окружности.
  // Используем это отображение для КАЖДОЙ точки пирамиды. Прежняя функция
  // искала треугольник основания отдельно для каждой точки; на диагоналях этих
  // треугольников формула менялась, поэтому прямая пересечения визуально
  // ломалась, а точка тройного разбиения выглядела посторонней вершиной.
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const determinant = ux * vy - uy * vx;
  if (Math.abs(determinant) <= 1e-12) return { x: sa.x, y: sa.y, z: depth };
  const px = world.x - a.x;
  const py = world.y - a.y;
  const u = (px * vy - py * vx) / determinant;
  const v = (ux * py - uy * px) / determinant;
  const atBase = {
    x: sa.x + u * (sb.x - sa.x) + v * (sc.x - sa.x),
    y: sa.y + u * (sb.y - sa.y) + v * (sc.y - sa.y),
  };
  const t = H > 1e-9 ? world.z / H : 0;
  return {
    x: atBase.x + kwx * t,
    y: atBase.y + kwy * t,
    z: depth,
  };
}

function pyramidLocalToView(
  local: LocalCoords,
  coeffs: ProjectionCoeffs,
  figure: PyramidFigure,
): { x: number; y: number; z: number } {
  return pyramidWorldToView(localToCartesian(local), coeffs, figure);
}

function prismWorldToView(
  world: Vec3,
  coeffs: ProjectionCoeffs,
  figure: PrismFigure,
): { x: number; y: number; z: number } {
  const H = prismHeight(figure.constraints);
  const baseScr = prismScreenBaseVertices(figure, coeffs);
  const proj = prismProjectionPyramid(figure);
  const depth = pyramidCartesianDepth(world, coeffs, proj);
  const { dx, dy } = prismTopScreenOffset(figure, coeffs, baseScr);
  const eps = 1e-4;

  if (Math.abs(world.z - H) <= eps) {
    const baseCart = pyramidBaseCartesianFromFigure(proj);
    for (let i = 0; i < baseCart.length; i += 1) {
      const c = baseCart[i]!;
      if ((world.x - c.x) ** 2 + (world.y - c.y) ** 2 < eps * eps) {
        const s = baseScr[i] ?? { x: 0, y: 0 };
        return { x: s.x + dx, y: s.y + dy, z: depth };
      }
    }
  }

  const baseCart = pyramidBaseCartesianFromFigure(proj);
  const { kwx, kwy } = coeffs;
  const anchor = pyramidApexScreenAnchor(proj, coeffs.orbit, baseScr);
  const lateral = pyramidProjectOnApexGenerator(
    world,
    proj,
    baseCart,
    baseScr,
    anchor,
    H,
    kwx,
    kwy,
  );
  if (lateral) {
    return { x: lateral.x, y: lateral.y, z: depth };
  }

  return pyramidWorldToView(world, coeffs, proj);
}

function prismLocalToView(
  local: LocalCoords,
  coeffs: ProjectionCoeffs,
  figure: PrismFigure,
): { x: number; y: number; z: number } {
  return prismWorldToView(localToCartesian(local), coeffs, figure);
}

/**
 * Общая аффинная («косоугольная») проекция (u,v,w) → (X,Y,Z): та же формула, что
 * у параллелепипеда. В отличие от `pyramidWorldToView` (сходящиеся к вершине S
 * рёбра, экранная позиция через полигон основания — корректна только рядом с
 * телом), это ПОЛНОСТЬЮ линейное отображение всего пространства без полигонов
 * и «ближайшего ребра» — гладкое и непрерывное для ЛЮБОЙ точки, включая далёкие
 * от тела (наблюдатель, отладочные лучи). Именно поэтому «глаз» пирамиды нужно
 * проецировать через эту функцию, а не через школьную модель самой фигуры.
 */
export function genericAffineLocalToView(
  local: LocalCoords,
  coeffs: ProjectionCoeffs,
): { x: number; y: number; z: number } {
  const { u, v, w } = local;
  const { kwx, kwy, yawRad, orbit } = coeffs;
  const { a, b, d } = baseCorners(orbit, yawRad);
  const xu = b.x - a.x;
  const xv = d.x - a.x;
  const yu = b.y - a.y;
  const yv = d.y - a.y;
  // Глубина обязана быть направлена точно вдоль луча этой же экранной
  // проекции. Прежняя формула через kx/ky описывала исходный косоугольный
  // вид, но не текущую эллиптическую орбиту и после половины оборота могла
  // менять визуальный порядок ближнего и дальнего.
  const depthAxis = affineProjectionDepthAxis(coeffs);
  // Порядок векторного произведения фиксирован и непрерывен на всей орбите:
  // знак нельзя повторно выбирать по старой оси — именно это давало инверсию
  // после прохождения противоположной половины оборота.
  return {
    x: a.x + u * xu + v * xv + kwx * w,
    y: a.y + u * yu + v * yv + kwy * w,
    z: u * depthAxis.u + v * depthAxis.v + w * depthAxis.w,
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
  if (figure && isPrism(figure)) return prismLocalToView(local, coeffs, figure);
  return genericAffineLocalToView(local, coeffs);
}

function localViewDirToWorld(
  vd: LocalCoords,
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 },
  figure: SpaceFigure,
): Vec3 {
  if (isSchoolExtrusionFigure(figure)) return { x: vd.u, y: vd.v, z: vd.w };
  return add(add(scale(basis.e1, vd.u), scale(basis.e2, vd.v)), scale(basis.e3, vd.w));
}

function figureUpWorld(basis: { e1: Vec3; e2: Vec3; e3: Vec3 }, figure: SpaceFigure): Vec3 {
  return isSchoolExtrusionFigure(figure) ? { x: 0, y: 0, z: 1 } : basis.e3;
}

/**
 * Расстояние до вертикальной «плоскости монитора» (содержит ось «вверх»),
 * нормаль в горизонтали крутится с yaw вместе с направлением взгляда на чертёж.
 * Меньше — ближе к наблюдателю.
 */
export function monitorPlaneSortDepth(
  world: Vec3,
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 },
  projection: ProjectionCoeffs,
  figure: SpaceFigure,
): number {
  const vd = viewDirectionLocal(projection);
  let dir = localViewDirToWorld(vd, basis, figure);
  const up = figureUpWorld(basis, figure);
  const upLen2 = dot(up, up);
  if (upLen2 > 1e-12) {
    dir = sub(dir, scale(up, dot(dir, up) / upLen2));
  }
  const dirLen = len(dir);
  if (!(dirLen > 1e-12)) return 0;
  const n = scale(dir, 1 / dirLen);
  return -dot(world, n);
}

/** Школьная глубина параллелепипеда — только аффинная ось, без «глаза». */
function parallelepipedSchoolSortDepth(
  world: Vec3,
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 },
  projection: ProjectionCoeffs,
): number {
  const local = worldToLocal(world, basis);
  if (!local) return 0;
  return genericAffineLocalToView(local, projection).z;
}

/**
 * Глубина world-точки для сортировки заливок плоскостей.
 * `eye`: пирамида — луч к «глазу»; параллелепипед — школьная ось (как изначально).
 * `plane`: обе фигуры — до вертикальной плоскости изображения.
 */
export function worldViewSortDepth(
  world: Vec3,
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 },
  projection: ProjectionCoeffs,
  figure: SpaceFigure,
  mode: PlaneFillDepthMode = "eye",
): number {
  if (mode === "plane") {
    return monitorPlaneSortDepth(world, basis, projection, figure);
  }
  if (isPyramid(figure)) {
    return pyramidCartesianDepth(world, projection, figure);
  }
  if (isPrism(figure)) {
    return pyramidCartesianDepth(world, projection, prismProjectionPyramid(figure));
  }
  return parallelepipedSchoolSortDepth(world, basis, projection);
}

/** Направление луча наблюдения в локальных (u,v,w). */
export function viewDirectionLocal(projection: ProjectionCoeffs): LocalCoords {
  return affineProjectionDepthAxis(projection);
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
  planeFillByDepth: true,
  showPlaneIntersections: false,
  planeFillDepthMode: "plane",
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
  const yawSteps = 24;
  for (let i = 0; i < yawSteps; i += 1) {
    const yawDeg = (i / yawSteps) * 360;
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
