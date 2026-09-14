import { projectFromLocalCoeffs, type ProjectedPoint } from "./camera";
import { facePlane, type ResolvedSpaceScene } from "./build";
import { adjacentFaceIds, edgeById, faceById, isPyramid } from "./figure";
import type { SpaceFigure, SpaceViewParams, Vec3 } from "./types";
import { add, cross, dot, len, normalize, scale, sub, worldToLocal, type PlaneEq } from "./vec3";
import { viewDirectionLocal } from "./camera";
import {
  isBodyEdgeVisibleSchool,
  splitLineSchoolView,
} from "./visibility-school";

/** Видимые грани: AA₁D₁D (левая), CDD₁C₁ (задняя), A₁B₁C₁D₁ (верхняя). */
export const VISIBLE_FACE_IDS = new Set(["f-left", "f-back", "f-top"]);

export function isBodyEdgeVisible(edgeId: string, figure: SpaceFigure): boolean {
  const edge = edgeById(figure, edgeId);
  if (!edge) return false;
  for (const faceId of VISIBLE_FACE_IDS) {
    const face = faceById(figure, faceId);
    if (!face) continue;
    if (face.vertexIds.includes(edge.aId) && face.vertexIds.includes(edge.bId)) return true;
  }
  return false;
}

export interface LineSplitSegment {
  a: Vec3;
  b: Vec3;
  visible: boolean;
}

interface ScreenVert {
  x: number;
  y: number;
  depth: number;
}

interface OccluderFace {
  id: string;
  verts: ScreenVert[];
  area: number;
}

export interface OcclusionContext {
  basis: ResolvedSpaceScene["basis"];
  projection: ResolvedSpaceScene["projection"];
  view: SpaceViewParams;
  figure: SpaceFigure;
  faces: OccluderFace[];
  /** Проекции 12 рёбер для 2D-пересечений. */
  edgeScreens: Array<{ aId: string; bId: string; a: ScreenVert; b: ScreenVert }>;
}

const DEPTH_EPS = 1e-4;
const T_EPS = 1e-7;
const MIN_FACE_AREA = 1e-8;

function projectWorldPoint(
  world: Vec3,
  local: { u: number; v: number; w: number } | null,
  ctx: OcclusionContext,
): ProjectedPoint {
  const lc =
    local ??
    worldToLocal(world, ctx.basis) ?? { u: 0, v: 0, w: 0 };
  return projectFromLocalCoeffs(lc, world, ctx.view, ctx.projection, ctx.figure);
}

function quadArea2D(v: ScreenVert[]): number {
  if (v.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < v.length; i += 1) {
    const a = v[i]!;
    const b = v[(i + 1) % v.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) * 0.5;
}

function pointInConvexPoly2D(px: number, py: number, verts: ScreenVert[]): boolean {
  if (verts.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < verts.length; i += 1) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (Math.abs(cross) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return sign !== 0;
}

/** Бilinear depth на четырёхугольнике грани. */
function depthOnFace(px: number, py: number, verts: ScreenVert[]): number {
  if (verts.length === 3) {
    const [v0, v1, v2] = verts;
    const den =
      (v1!.y - v2!.y) * (v0!.x - v2!.x) + (v2!.x - v1!.x) * (v0!.y - v2!.y);
    if (Math.abs(den) < 1e-12) return (v0!.depth + v1!.depth + v2!.depth) / 3;
    const w0 =
      ((v1!.y - v2!.y) * (px - v2!.x) + (v2!.x - v1!.x) * (py - v2!.y)) / den;
    const w1 =
      ((v2!.y - v0!.y) * (px - v2!.x) + (v0!.x - v2!.x) * (py - v2!.y)) / den;
    const w2 = 1 - w0 - w1;
    return w0 * v0!.depth + w1 * v1!.depth + w2 * v2!.depth;
  }
  const [v0, v1, v2, v3] = verts;
  const denom = (v2!.x - v0!.x) * (v3!.y - v0!.y) - (v2!.y - v0!.y) * (v3!.x - v0!.x);
  if (Math.abs(denom) < 1e-12) {
    return (v0!.depth + v1!.depth + v2!.depth + v3!.depth) * 0.25;
  }
  const u = ((px - v0!.x) * (v3!.y - v0!.y) - (py - v0!.y) * (v3!.x - v0!.x)) / denom;
  const v = ((px - v0!.x) * (v1!.y - v0!.y) - (py - v0!.y) * (v1!.x - v0!.x)) / denom;
  const d0 = v0!.depth + u * (v1!.depth - v0!.depth) + v * (v3!.depth - v0!.depth);
  const d1 = v0!.depth + u * (v2!.depth - v0!.depth) + v * (v3!.depth - v0!.depth);
  return (d0 + d1) * 0.5;
}

export function buildOcclusionContext(
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): OcclusionContext {
  const ctx: OcclusionContext = {
    basis: resolved.basis,
    projection: resolved.projection,
    view,
    figure,
    faces: [],
    edgeScreens: [],
  };

  for (const face of figure.faces) {
    const raw = face.vertexIds
      .map((id) => {
        const pt = resolved.points.get(id);
        if (!pt) return null;
        const pr = projectWorldPoint(pt.world, pt.local, ctx);
        return { x: pr.x, y: pr.y, depth: pr.depth };
      })
      .filter(Boolean) as ScreenVert[];
    if (raw.length < 3) continue;
    const area = quadArea2D(raw.length === 3 ? [...raw, raw[0]!] : raw);
    if (area < MIN_FACE_AREA) continue;
    ctx.faces.push({
      id: face.id,
      verts: raw,
      area,
    });
  }

  for (const edge of figure.edges) {
    const pa = resolved.points.get(edge.aId);
    const pb = resolved.points.get(edge.bId);
    if (!pa || !pb) continue;
    const a = projectWorldPoint(pa.world, pa.local, ctx);
    const b = projectWorldPoint(pb.world, pb.local, ctx);
    ctx.edgeScreens.push({
      aId: edge.aId,
      bId: edge.bId,
      a: { x: a.x, y: a.y, depth: a.depth },
      b: { x: b.x, y: b.y, depth: b.depth },
    });
  }

  return ctx;
}

/** Ближайшая к наблюдателю поверхность тела в экранной точке; null — тела нет. */
export function frontSurfaceDepth(px: number, py: number, ctx: OcclusionContext): number | null {
  let best: number | null = null;
  for (const face of ctx.faces) {
    if (!pointInConvexPoly2D(px, py, face.verts)) continue;
    const z = depthOnFace(px, py, face.verts);
    if (best === null || z < best) best = z;
  }
  return best;
}

export function isPointVisible(world: Vec3, local: { u: number; v: number; w: number } | null, ctx: OcclusionContext): boolean {
  const pr = projectWorldPoint(world, local, ctx);
  const surface = frontSurfaceDepth(pr.x, pr.y, ctx);
  if (surface === null) return true;
  return pr.depth <= surface + DEPTH_EPS;
}

function mergeBreakpoints(values: number[], t0: number, t1: number): number[] {
  const sorted = [...values, t0, t1].sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of sorted) {
    if (t < t0 - T_EPS || t > t1 + T_EPS) continue;
    const clamped = Math.min(t1, Math.max(t0, t));
    if (!out.length || Math.abs(clamped - out[out.length - 1]!) > T_EPS) out.push(clamped);
  }
  return out;
}

function intersectLinePlaneT(origin: Vec3, dir: Vec3, plane: PlaneEq): number | null {
  const denom = dot(plane.normal, dir);
  if (Math.abs(denom) < 1e-9) return null;
  return -(dot(plane.normal, origin) + plane.d) / denom;
}

export function pointInFace3D(
  p: Vec3,
  faceVertexIds: string[],
  points: ResolvedSpaceScene["points"],
): boolean {
  const verts = faceVertexIds.map((id) => points.get(id)?.world).filter(Boolean) as Vec3[];
  if (verts.length < 4) return false;
  const [v0, v1, v2, v3] = verts;
  const n = cross(sub(v1!, v0!), sub(v2!, v0!));
  if (len(n) < 1e-9) return false;
  const nn = scale(n, 1 / len(n));
  const toP = sub(p, v0!);
  if (Math.abs(dot(toP, nn)) > 1e-4) return false;
  const e1 = sub(v1!, v0!);
  const e2 = sub(v3!, v0!);
  const a = dot(e1, e1);
  const b = dot(e1, e2);
  const c = dot(e2, e2);
  const d = dot(e1, toP);
  const e = dot(e2, toP);
  const denom = a * c - b * b;
  if (Math.abs(denom) < 1e-9) return false;
  const u = (d * c - b * e) / denom;
  const v = (a * e - b * d) / denom;
  return u >= -0.02 && v >= -0.02 && u + v <= 1.02;
}

export function classifySegmentFaceVisibility(
  a: Vec3,
  b: Vec3,
  figure: SpaceFigure,
  points: ResolvedSpaceScene["points"],
): "visible" | "hidden" | "occlude" {
  for (const faceId of VISIBLE_FACE_IDS) {
    const face = faceById(figure, faceId);
    if (!face) continue;
    if (pointInFace3D(a, face.vertexIds, points) && pointInFace3D(b, face.vertexIds, points)) {
      return "visible";
    }
  }
  for (const face of figure.faces) {
    if (VISIBLE_FACE_IDS.has(face.id)) continue;
    if (pointInFace3D(a, face.vertexIds, points) && pointInFace3D(b, face.vertexIds, points)) {
      return "hidden";
    }
  }
  return "occlude";
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function segSegIntersectionT(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number | null {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
  if (t < -T_EPS || t > 1 + T_EPS || u < -T_EPS || u > 1 + T_EPS) return null;
  return t;
}

function screenTFromWorldT(
  origin: Vec3,
  dir: Vec3,
  tLine: number,
  ctx: OcclusionContext,
): { x: number; y: number } {
  const w = add(origin, scale(dir, tLine));
  const lc = worldToLocal(w, ctx.basis);
  const pr = projectWorldPoint(w, lc, ctx);
  return { x: pr.x, y: pr.y };
}

/** Разбиение линии на видимые/скрытые участки относительно непрозрачных граней. */
export function splitLineByVisibility(
  origin: Vec3,
  dir: Vec3,
  t0: number,
  t1: number,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  ctx?: OcclusionContext,
): LineSplitSegment[] {
  const occluder = ctx ?? buildOcclusionContext(figure, resolved, view);
  const breakpoints: number[] = [];

  for (const face of figure.faces) {
    const plane = facePlane(figure, face.id, resolved.points);
    if (!plane) continue;
    const tHit = intersectLinePlaneT(origin, dir, plane);
    if (tHit === null || tHit < t0 - T_EPS || tHit > t1 + T_EPS) continue;
    const p = add(origin, scale(dir, tHit));
    if (pointInFace3D(p, face.vertexIds, resolved.points)) breakpoints.push(tHit);
  }

  const pStart = screenTFromWorldT(origin, dir, t0, occluder);
  const pEnd = screenTFromWorldT(origin, dir, t1, occluder);

  for (const edge of occluder.edgeScreens) {
    const t = segSegIntersectionT(
      pStart.x,
      pStart.y,
      pEnd.x,
      pEnd.y,
      edge.a.x,
      edge.a.y,
      edge.b.x,
      edge.b.y,
    );
    if (t === null) continue;
    const tWorld = t0 + t * (t1 - t0);
    if (tWorld >= t0 - T_EPS && tWorld <= t1 + T_EPS) breakpoints.push(tWorld);
  }

  const sorted = mergeBreakpoints(breakpoints, t0, t1);
  const segments: LineSplitSegment[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const ta = sorted[i]!;
    const tb = sorted[i + 1]!;
    if (tb - ta < T_EPS) continue;
    const tm = (ta + tb) * 0.5;
    const mid = add(origin, scale(dir, tm));
    const lc = worldToLocal(mid, occluder.basis);
    const visible = isPointVisible(mid, lc, occluder);
    segments.push({
      a: add(origin, scale(dir, ta)),
      b: add(origin, scale(dir, tb)),
      visible,
    });
  }

  if (!segments.length) {
    segments.push({
      a: add(origin, scale(dir, t0)),
      b: add(origin, scale(dir, t1)),
      visible: isPointVisible(add(origin, scale(dir, (t0 + t1) * 0.5)), null, occluder),
    });
  }

  return mergeAdjacentSegments(segments);
}

function mergeAdjacentSegments(segments: LineSplitSegment[]): LineSplitSegment[] {
  if (segments.length < 2) return segments;
  const out: LineSplitSegment[] = [{ ...segments[0]! }];
  for (let i = 1; i < segments.length; i += 1) {
    const prev = out[out.length - 1]!;
    const cur = segments[i]!;
    if (cur.visible === prev.visible && len(sub(cur.a, prev.b)) < 1e-6) {
      prev.b = cur.b;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

export function renderEdgeSegments(
  aWorld: Vec3,
  bWorld: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  ctx: OcclusionContext,
): LineSplitSegment[] {
  const dir = sub(bWorld, aWorld);
  const abLen = len(dir);
  if (!(abLen > 1e-9)) return [];
  return splitLineForRender(aWorld, scale(dir, 1 / abLen), 0, abLen, figure, resolved, view, ctx);
}

/** Режим видимости из параметров вида (по умолчанию school). */
export function getVisibilityMode(view: SpaceViewParams): "school" | "legacy" {
  return view.visibilityMode ?? "school";
}

function viewDirectionWorld(resolved: ResolvedSpaceScene, figure: SpaceFigure): Vec3 {
  const vd = viewDirectionLocal(resolved.projection);
  const { e1, e2, e3 } = resolved.basis;
  return normalize(add(add(scale(e1, vd.u), scale(e2, vd.v)), scale(e3, vd.w)));
}

function isFaceFrontFacingWorld(
  faceId: string,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
): boolean {
  const face = faceById(figure, faceId);
  if (!face || face.vertexIds.length < 3) return false;
  const ps = face.vertexIds.map((id) => resolved.points.get(id)?.world).filter(Boolean) as Vec3[];
  if (ps.length < 3) return false;
  const n = normalize(cross(sub(ps[1]!, ps[0]!), sub(ps[2]!, ps[0]!)));
  return dot(n, viewDirectionWorld(resolved, figure)) < -1e-5;
}

/** Ребро видно, если хотя бы одна смежная грань обращена к наблюдателю. */
function isBodyEdgeVisiblePyramid(
  edgeId: string,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
): boolean {
  const faceIds = adjacentFaceIds(figure, edgeId);
  if (faceIds.length === 0) return true;
  return faceIds.some((fid) => isFaceFrontFacingWorld(fid, figure, resolved));
}

/** Видимость ребра тела: school — через грани, legacy — по списку граней. */
export function isBodyEdgeVisibleForRender(
  edgeId: string,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): boolean {
  if (isPyramid(figure)) return isBodyEdgeVisiblePyramid(edgeId, figure, resolved);
  if (getVisibilityMode(view) === "legacy") return isBodyEdgeVisible(edgeId, figure);
  return isBodyEdgeVisibleSchool(edgeId, figure, resolved.projection);
}

/** Разбиение линии на видимые/скрытые участки (переключаемый режим). */
export function splitLineForRender(
  origin: Vec3,
  dir: Vec3,
  t0: number,
  t1: number,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  ctx?: OcclusionContext,
): LineSplitSegment[] {
  if (isPyramid(figure) || getVisibilityMode(view) === "legacy") {
    return splitLineByVisibility(origin, dir, t0, t1, figure, resolved, view, ctx);
  }
  return splitLineSchoolView(origin, dir, t0, t1, figure, resolved, view);
}
