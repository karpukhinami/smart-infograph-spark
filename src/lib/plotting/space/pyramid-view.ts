/**
 * Наблюдатель и глубина пирамиды в декартовых координатах (local = x,y,z).
 * Направление «глаза» выводится из видимых граней (контур 2D-проекции + yaw).
 */
import type { ResolvedSpaceScene } from "./build";
import { viewDirectionLocal, type ProjectionCoeffs } from "./camera";
import type { ProjectionHull } from "./convex-hull-visibility";
import { isBodyEdgeVisibleProjectionHull } from "./convex-hull-visibility";
import { faceById } from "./figure";
import type { SpaceFigure, Vec3 } from "./types";
import { add, cross, dot, len, normalize, scale, sub } from "./vec3";

const SURFACE_EPS = 1e-4;
const OBSERVER_SCALE = 6;

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

/** Запасной вектор к наблюдателю из школьной проекции (меняется с yaw). */
export function pyramidViewDirectionFromProjection(projection: ProjectionCoeffs): Vec3 {
  const vd = viewDirectionLocal(projection);
  return normalize({ x: vd.u, y: vd.v, z: vd.w });
}

/**
 * «Глаз» снаружи видимой части: среднее направление нормалей граней,
 * у которых рёбра на 2D-контуре не скрыты (связь с выпуклой оболочкой).
 */
export function buildPyramidObserver(
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  projection: ProjectionCoeffs,
  hull: ProjectionHull,
): PyramidObserver {
  const center = figureBodyCenterCartesian(figure, resolved);
  let sum = { x: 0, y: 0, z: 0 };
  let count = 0;
  for (const face of figure.faces) {
    let faceVisible = true;
    for (const edge of figure.edges) {
      if (!face.vertexIds.includes(edge.aId) || !face.vertexIds.includes(edge.bId)) continue;
      if (!isBodyEdgeVisibleProjectionHull(edge.aId, edge.bId, hull)) {
        faceVisible = false;
        break;
      }
    }
    if (!faceVisible) continue;
    const n = outwardFaceNormalCartesian(face.id, figure, resolved);
    if (!n) continue;
    sum = add(sum, n);
    count += 1;
  }
  const toViewer =
    count > 0 && len(sum) > 1e-9
      ? normalize(sum)
      : pyramidViewDirectionFromProjection(projection);
  const extent =
    figure.vertices
      .map((v) => resolved.points.get(v.id)?.world)
      .filter(Boolean)
      .reduce((m, w) => Math.max(m, len(sub(w!, center))), 0) || 1;
  const eye = add(center, scale(toViewer, OBSERVER_SCALE * extent));
  return { eye, toViewer };
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
