/**
 * Наблюдатель и глубина пирамиды в декартовых координатах (local = x,y,z).
 * Направление «глаза» выводится из видимых граней (контур 2D-проекции + yaw).
 */
import type { ResolvedSpaceScene } from "./build";
import { viewDirectionLocal, type ProjectionCoeffs } from "./camera";
import type { ProjectionHull } from "./convex-hull-visibility";
import { faceById, isSchoolExtrusionFigure } from "./figure";
import {
  PYRAMID_OBSERVER_EYE_AT_YAW_ZERO,
  pyramidObserverEyePosition,
  rotateCartesianZ,
} from "./pyramid";
import type { SpaceFigure, Vec3 } from "./types";
import { add, cross, dot, len, normalize, scale, sub } from "./vec3";

export { PYRAMID_OBSERVER_EYE_AT_YAW_ZERO, pyramidObserverEyePosition, rotateCartesianZ };

const SURFACE_EPS = 1e-4;
/** Расстояние «глаза» от центра параллелепипеда (пирамида — фиксированные координаты в pyramid.ts). */
const OBSERVER_DISTANCE_K = 2;

export type PyramidObserver = {
  /** Положение «глаза» в декартовых координатах. */
  eye: Vec3;
  /** Единичный вектор от центра тела к наблюдателю (зависит от yaw и видимых граней). */
  toViewer: Vec3;
};

function cross3(a: Vec3, b: Vec3): Vec3 {
  return cross(a, b);
}

function figureBodyCenterCartesian(figure: SpaceFigure, resolved: ResolvedSpaceScene): Vec3 {
  const ps = figure.vertices
    .map((v) => resolved.points.get(v.id)?.world)
    .filter(Boolean) as Vec3[];
  if (!ps.length) return { x: 0, y: 0, z: 0 };
  return scale(
    ps.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }),
    1 / ps.length,
  );
}

function outwardFaceNormalCartesian(
  faceId: string,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
): Vec3 | null {
  const face = faceById(figure, faceId);
  if (!face || face.vertexIds.length < 3) return null;
  const ps = face.vertexIds.map((id) => resolved.points.get(id)?.world).filter(Boolean) as Vec3[];
  if (ps.length < 3) return null;
  let n = normalize(cross3(sub(ps[1]!, ps[0]!), sub(ps[2]!, ps[0]!)));
  const center = scale(
    ps.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }),
    1 / ps.length,
  );
  const body = figureBodyCenterCartesian(figure, resolved);
  if (dot(n, sub(center, body)) < 0) n = scale(n, -1);
  return n;
}

/** Направление на наблюдателя при yaw=0 (школьная проекция), в I-м октанте. */
export function pyramidObserverDirectionAtYawZero(projection: ProjectionCoeffs): Vec3 {
  const vd = viewDirectionLocal({ ...projection, yawRad: 0 });
  let d = normalize({ x: vd.u, y: vd.v, z: vd.w });
  const oct = { x: 1, y: 1, z: 1 };
  if (dot(d, oct) < 0) d = scale(d, -1);
  return d;
}

/**
 * Наблюдатель для ОТЛАДОЧНОЙ ВИЗУАЛИЗАЦИИ (лучи к «глазу»): «глаз» — это
 * фиксированный читатель чертежа, а не часть вращающейся модели. Поэтому его
 * положение НЕ поворачивается вместе с yaw — оно всегда (4,4,1), как при yaw=0.
 * (Для расчёта ГЛУБИНЫ заливок используется отдельная, действительно
 * yaw-зависимая функция `pyramidObserverEyePosition` из camera.ts —
 * там поворот на −yaw корректен и даёт согласованную сортировку по глубине;
 * см. `pyramidCartesianDepth`. Это два разных назначения одной идеи «глаза».)
 */
function pyramidObserverFromFixedEye(
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  projection: ProjectionCoeffs,
): PyramidObserver {
  const center = figureBodyCenterCartesian(figure, resolved);
  const eye = PYRAMID_OBSERVER_EYE_AT_YAW_ZERO;
  const delta = sub(eye, center);
  const d = len(delta);
  const toViewer = d > 1e-9 ? scale(delta, 1 / d) : pyramidObserverDirectionAtYawZero(projection);
  return { eye, toViewer };
}

/** Единичный вектор center → eye (для совместимости). */
export function pyramidObserverToViewer(
  projection: ProjectionCoeffs,
  bodyCenter: Vec3 = { x: 0, y: 0, z: 0.4 },
): Vec3 {
  const eye = pyramidObserverEyePosition(projection.yawRad);
  return normalize(sub(eye, bodyCenter));
}

/** @deprecated alias */
export function pyramidViewDirectionFromProjection(
  projection: ProjectionCoeffs,
  bodyCenter?: Vec3,
): Vec3 {
  return pyramidObserverToViewer(projection, bodyCenter);
}

function observerExtent(figure: SpaceFigure, resolved: ResolvedSpaceScene, center: Vec3): number {
  return (
    figure.vertices
      .map((v) => resolved.points.get(v.id)?.world)
      .filter(Boolean)
      .reduce((m, w) => Math.max(m, len(sub(w!, center))), 0) || 1
  );
}

export function buildPyramidObserver(
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  projection: ProjectionCoeffs,
  _hull: ProjectionHull,
): PyramidObserver {
  return pyramidObserverFromFixedEye(figure, resolved, projection);
}

/** Условный «глаз» школьной проекции (пирамида — декартов z-↔yaw, параллелепипед — viewDirectionLocal). */
export function buildSchoolViewObserver(
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  projection: ProjectionCoeffs,
): PyramidObserver {
  const center = figureBodyCenterCartesian(figure, resolved);
  const extent = observerExtent(figure, resolved, center);
  if (isSchoolExtrusionFigure(figure)) {
    return pyramidObserverFromFixedEye(figure, resolved, projection);
  }
  const vd = viewDirectionLocal({ ...projection, yawRad: 0 });
  const { e1, e2, e3 } = resolved.basis;
  const toViewer = normalize(
    add(add(scale(e1, vd.u), scale(e2, vd.v)), scale(e3, vd.w)),
  );
  return { eye: add(center, scale(toViewer, OBSERVER_DISTANCE_K * extent)), toViewer };
}

export function figureBodyCenterWorld(
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
): Vec3 {
  return figureBodyCenterCartesian(figure, resolved);
}

/** Больше значение — точка дальше от наблюдателя вдоль луча обзора. */
export function cartesianDepthFromObserver(p: Vec3, observer: PyramidObserver): number {
  return dot(sub(p, observer.eye), scale(observer.toViewer, -1));
}

function pointInTriangle3D(p: Vec3, verts: Vec3[], eps = SURFACE_EPS): boolean {
  if (verts.length < 3) return false;
  const [v0, v1, v2] = verts;
  const planeN = cross3(sub(v1!, v0!), sub(v2!, v0!));
  if (len(planeN) < 1e-12) return false;
  const nn = scale(planeN, 1 / len(planeN));
  if (Math.abs(dot(sub(p, v0!), nn)) > eps) return false;
  let s = 0;
  for (let i = 0; i < 3; i += 1) {
    const a = verts[i]!;
    const b = verts[(i + 1) % 3]!;
    const cr = cross3(sub(b, a), sub(p, a));
    const d = dot(cr, nn);
    if (Math.abs(d) <= eps * eps) continue;
    if (s === 0) s = Math.sign(d);
    else if (Math.sign(d) !== s) return false;
  }
  return s !== 0;
}

function pointInConvexFacePolygon(p: Vec3, verts: Vec3[], eps = SURFACE_EPS): boolean {
  if (verts.length < 3) return false;
  if (verts.length === 3) return pointInTriangle3D(p, verts, eps);
  for (let i = 1; i + 1 < verts.length; i += 1) {
    if (pointInTriangle3D(p, [verts[0]!, verts[i]!, verts[i + 1]!], eps)) return true;
  }
  return false;
}

function pointOnPyramidSurface(
  p: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
): boolean {
  for (const face of figure.faces) {
    const verts = face.vertexIds
      .map((id) => resolved.points.get(id)?.world)
      .filter(Boolean) as Vec3[];
    if (pointInConvexFacePolygon(p, verts)) return true;
  }
  return false;
}

/** Строго внутри объёма (не на грани/ребре). */
export function isStrictlyInsidePyramidVolume(
  p: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
): boolean {
  if (pointOnPyramidSurface(p, figure, resolved)) return false;
  for (const face of figure.faces) {
    const verts = face.vertexIds
      .map((id) => resolved.points.get(id)?.world)
      .filter(Boolean) as Vec3[];
    if (verts.length < 3) continue;
    const n = outwardFaceNormalCartesian(face.id, figure, resolved);
    if (!n) continue;
    if (dot(n, sub(p, verts[0]!)) > SURFACE_EPS) return false;
  }
  return true;
}

export function isSegmentInsidePyramidVolume(
  aWorld: Vec3,
  bWorld: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
): boolean {
  const mid = scale(add(aWorld, bWorld), 0.5);
  if (isStrictlyInsidePyramidVolume(mid, figure, resolved)) return true;
  if (isStrictlyInsidePyramidVolume(aWorld, figure, resolved)) return true;
  if (isStrictlyInsidePyramidVolume(bWorld, figure, resolved)) return true;
  return false;
}
