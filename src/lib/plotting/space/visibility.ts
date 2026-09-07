import { add, dot, lerp, scale, sub } from "./vec3";
import { facePlane, type ResolvedSpaceScene } from "./build";
import { viewDirection } from "./camera";
import type { ParallelepipedFigure, RenderLineSegment, SpaceViewParams, Vec3 } from "./types";
import type { PlaneEq } from "./vec3";

export interface LineSplitSegment {
  a: Vec3;
  b: Vec3;
  visible: boolean;
}

/** Разбиение отображаемого участка линии на видимые/скрытые части относительно тела. */
export function splitLineByVisibility(
  origin: Vec3,
  dir: Vec3,
  t0: number,
  t1: number,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): LineSplitSegment[] {
  const breakpoints = new Set<number>([t0, t1]);
  const aWorld = add(origin, scale(dir, t0));
  const bWorld = add(origin, scale(dir, t1));

  for (const face of figure.faces) {
    const plane = facePlane(figure, face.id, resolved.points);
    if (!plane) continue;
    const hit = intersectLinePlane(origin, dir, plane);
    if (hit === null) continue;
    if (hit >= t0 - 1e-6 && hit <= t1 + 1e-6) breakpoints.add(hit);
  }

  const sorted = [...breakpoints].sort((x, y) => x - y);
  const segments: LineSplitSegment[] = [];
  const viewDir = viewDirection(view);

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const ta = sorted[i]!;
    const tb = sorted[i + 1]!;
    if (tb - ta < 1e-8) continue;
    const mid = (ta + tb) / 2;
    const midWorld = add(origin, scale(dir, mid));
    const visible = !isHiddenByBody(midWorld, figure, resolved, viewDir);
    segments.push({
      a: add(origin, scale(dir, ta)),
      b: add(origin, scale(dir, tb)),
      visible,
    });
  }

  if (!segments.length) {
    segments.push({ a: aWorld, b: bWorld, visible: true });
  }
  return segments;
}

function intersectLinePlane(origin: Vec3, dir: Vec3, plane: PlaneEq): number | null {
  const denom = dot(plane.normal, dir);
  if (Math.abs(denom) < 1e-9) return null;
  return -(dot(plane.normal, origin) + plane.d) / denom;
}

function isHiddenByBody(
  p: Vec3,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  viewDir: Vec3,
): boolean {
  for (const face of figure.faces) {
    const plane = facePlane(figure, face.id, resolved.points);
    if (!plane) continue;
    const verts = face.vertexIds
      .map((id) => resolved.points.get(id)?.world)
      .filter(Boolean) as Vec3[];
    if (verts.length < 3) continue;
    const toPoint = sub(p, verts[0]!);
    const faceDist = dot(plane.normal, toPoint);
    const facing = dot(plane.normal, viewDir) > 0;
    if (!facing) continue;
    const rayTest = dot(plane.normal, viewDir);
    if (Math.abs(rayTest) < 1e-9) continue;
    const tHit = -faceDist / rayTest;
    if (tHit > 1e-6) {
      const occluder = add(p, scale(viewDir, -tHit));
      if (pointInFaceQuad(occluder, verts)) return true;
    }
  }
  return false;
}

function pointInFaceQuad(p: Vec3, verts: Vec3[]): boolean {
  if (verts.length < 4) return false;
  const [v0, v1, v2, v3] = verts;
  const n = sub(v1!, v0!);
  const m = sub(v3!, v0!);
  const q = sub(p, v0!);
  const det = n.x * m.y - n.y * m.x + (n.x * m.z - n.z * m.x); // rough
  const a = dot(n, n);
  const b = dot(n, m);
  const c = dot(m, m);
  const d = dot(n, q);
  const e = dot(m, q);
  const denom = a * c - b * b;
  if (Math.abs(denom) < 1e-9) return false;
  const u = (d * c - b * e) / denom;
  const v = (a * e - b * d) / denom;
  return u >= -0.02 && v >= -0.02 && u <= 1.02 && v <= 1.02;
}

export function segmentsToRender(
  segments: LineSplitSegment[],
  projected: Map<string, { x: number; y: number; depth: number; world: Vec3 }>,
  sourceId: string,
  color: string,
  width: number,
  dashedHidden: string,
  project: (w: Vec3) => { x: number; y: number },
): RenderLineSegment[] {
  return segments.map((seg) => {
    const p1 = project(seg.a);
    const p2 = project(seg.b);
    return {
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      visible: seg.visible,
      color,
      width,
      dashed: !seg.visible,
      sourceId,
    };
  });
}

export function projectWorld(
  world: Vec3,
  projectFn: (w: Vec3) => { x: number; y: number },
): { x: number; y: number } {
  return projectFn(world);
}
