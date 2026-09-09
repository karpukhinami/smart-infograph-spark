import type { SpaceFigure, SpaceSceneData, Vec3 } from "./types";
import {
  computeFaceOrPlaneSection,
  planeIntersectionSegmentRange,
  resolveLineCarrier,
  type ResolvedSpaceScene,
} from "./build";
import { splitLineForRender } from "./visibility";
import { add, len, scale, sub } from "./vec3";

export type ScreenPoint = { x: number; y: number };
export type ScreenSegment = { a: ScreenPoint; b: ScreenPoint };

const COLLINEAR_EPS = 0.035;
const DIST_EPS = 3.5;

function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** Экранный отрезок overlay полностью покрывает ребро (коллинеарен и не короче). */
export function screenSegmentCoversEdge(
  overlay: ScreenSegment,
  edge: ScreenSegment,
  distTol = DIST_EPS,
): boolean {
  const { a: oa, b: ob } = overlay;
  const { a: ea, b: eb } = edge;
  const odx = ob.x - oa.x;
  const ody = ob.y - oa.y;
  const edx = eb.x - ea.x;
  const edy = eb.y - ea.y;
  const olen = Math.hypot(odx, ody);
  const elen = Math.hypot(edx, edy);
  if (!(olen > 1e-6) || !(elen > 1e-6)) return false;

  const cross = Math.abs(odx * edy - ody * edx) / (olen * elen);
  if (cross > COLLINEAR_EPS) return false;

  if (distPointToSegment(ea.x, ea.y, oa.x, oa.y, ob.x, ob.y) > distTol) return false;
  if (distPointToSegment(eb.x, eb.y, oa.x, oa.y, ob.x, ob.y) > distTol) return false;

  const ux = odx / olen;
  const uy = ody / olen;
  const tEa = (ea.x - oa.x) * ux + (ea.y - oa.y) * uy;
  const tEb = (eb.x - oa.x) * ux + (eb.y - oa.y) * uy;
  const minE = Math.min(tEa, tEb);
  const maxE = Math.max(tEa, tEb);
  const minO = Math.min(0, olen);
  const maxO = Math.max(0, olen);
  return minE >= minO - distTol && maxE <= maxO + distTol;
}

function projectWorldToScreen(
  world: Vec3,
  project: (w: Vec3) => ScreenPoint,
): ScreenPoint {
  return project(world);
}

function visibleLineScreenSegments(
  line: SpaceSceneData["lines"][number],
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
  fit: { scale: number; cx: number; cy: number },
  occlusion: Parameters<typeof splitLineForRender>[7],
  projectWorld: (w: Vec3) => ScreenPoint,
): ScreenSegment[] {
  if (!line.built || !line.style.visible) return [];
  const carrier = resolveLineCarrier(line, figure, resolved.points, resolved.planes, data.lines);
  if (!carrier) return [];

  const def = line.definition;
  let origin = carrier.origin;
  let dir = carrier.dir;
  let t0 = -1;
  let t1 = 1;

  if (def.kind === "twoPoints") {
    const a = resolved.points.get(def.aId)?.world;
    const b = resolved.points.get(def.bId)?.world;
    if (!a || !b) return [];
    const abLen = len(sub(b, a));
    if (!(abLen > 1e-9)) return [];
    origin = a;
    dir = scale(sub(b, a), 1 / abLen);
    if (line.style.visualKind === "segment" || line.style.visualKind === "vector") {
      t0 = 0;
      t1 = abLen;
    } else {
      t0 = -abLen * 2;
      t1 = abLen * 3;
    }
  } else {
    const clip = planeIntersectionSegmentRange(
      carrier,
      def.planeAId,
      def.planeBId,
      figure,
      resolved.points,
      resolved.planes,
      resolved.basis,
    );
    if (!clip) return [];
    t0 = clip.t0;
    t1 = clip.t1;
    if (line.style.visualKind === "line") {
      const span = Math.max(t1 - t0, 1e-6);
      const ext = data.appearance.lineExtension * span;
      t0 -= ext;
      t1 += ext;
    }
  }

  const parts = splitLineForRender(origin, dir, t0, t1, figure, resolved, view, occlusion);
  const out: ScreenSegment[] = [];
  for (const part of parts) {
    if (!part.visible) continue;
    out.push({
      a: projectWorldToScreen(part.a, projectWorld),
      b: projectWorldToScreen(part.b, projectWorld),
    });
  }
  return out;
}

function visiblePlaneSectionSegments(
  plane: SpaceSceneData["planes"][number],
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
  occlusion: Parameters<typeof splitLineForRender>[7],
  projectWorld: (w: Vec3) => ScreenPoint,
): ScreenSegment[] {
  if (!plane.built || !plane.style.visible) return [];
  const section = computeFaceOrPlaneSection(
    plane.id,
    figure,
    resolved.points,
    resolved.planes,
    resolved.basis,
  );
  if (!section || section.length < 2) return [];

  const out: ScreenSegment[] = [];
  for (let i = 0; i < section.length; i += 1) {
    const a = section[i]!;
    const b = section[(i + 1) % section.length]!;
    const dir = sub(b, a);
    const abLen = len(dir);
    if (!(abLen > 1e-9)) continue;
    const parts = splitLineForRender(a, scale(dir, 1 / abLen), 0, abLen, figure, resolved, view, occlusion);
    for (const part of parts) {
      if (!part.visible) continue;
      out.push({
        a: projectWorldToScreen(part.a, projectWorld),
        b: projectWorldToScreen(part.b, projectWorld),
      });
    }
  }
  return out;
}

/** Собирает видимые (сплошные) экранные отрезки линий и границ сечений плоскостей. */
export function collectVisibleOverlaySegments(
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
  fit: { scale: number; cx: number; cy: number },
  occlusion: Parameters<typeof splitLineForRender>[7],
  projectWorld: (w: Vec3) => ScreenPoint,
): ScreenSegment[] {
  const segs: ScreenSegment[] = [];
  for (const line of data.lines) {
    segs.push(
      ...visibleLineScreenSegments(line, data, figure, resolved, view, fit, occlusion, projectWorld),
    );
  }
  for (const plane of data.planes) {
    segs.push(
      ...visiblePlaneSectionSegments(plane, data, figure, resolved, view, occlusion, projectWorld),
    );
  }
  return segs;
}

export function isEdgeCoveredOnScreen(
  edgeScreen: ScreenSegment,
  overlays: ScreenSegment[],
): boolean {
  for (const overlay of overlays) {
    if (screenSegmentCoversEdge(overlay, edgeScreen)) return true;
  }
  return false;
}
