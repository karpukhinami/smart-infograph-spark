import {
  computeFaceOrPlaneSection,
  planeIntersectionSegmentRange,
  type ResolvedSpaceScene,
} from "./build";
import type { SpaceFigure, SpaceSceneData, Vec3 } from "./types";
import {
  add,
  cross,
  dot,
  intersectPlanes,
  len,
  normalize,
  planePointDistance,
  scale,
  sub,
  type PlaneEq,
} from "./vec3";

export type ScreenProjectedPoint = { x: number; y: number; depth: number };
export type ScreenProjectFn = (world: Vec3) => ScreenProjectedPoint;

export interface PlaneFillFragment {
  planeId: string;
  color: string;
  vertices: Vec3[];
  /** Средняя глубина в той же проекции, которой рисуется фрагмент. Меньше = ближе. */
  depth: number;
}

const WORLD_EPS = 1e-5;
const AREA_EPS = 1e-10;
const SCREEN_EPS = 1e-6;
const DEPTH_EPS = 1e-7;

function samePoint(a: Vec3, b: Vec3, eps = WORLD_EPS): boolean {
  return len(sub(a, b)) <= eps;
}

function canonicalPoint(point: Vec3, eps: number): Vec3 {
  const snap = (value: number) => Math.round(value / eps) * eps;
  return { x: snap(point.x), y: snap(point.y), z: snap(point.z) };
}

function polygonScale(vertices: Vec3[]): number {
  if (vertices.length < 2) return 1;
  let diameter = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      diameter = Math.max(diameter, len(sub(vertices[i]!, vertices[j]!)));
    }
  }
  return Math.max(diameter, 1);
}

/** Удаляет дубли и точки на прямой, которые накапливаются после нескольких разрезов. */
function normalizePolygon(vertices: Vec3[]): Vec3[] {
  const clean: Vec3[] = [];
  for (const vertex of vertices) {
    if (!clean.length || !samePoint(vertex, clean[clean.length - 1]!)) clean.push(vertex);
  }
  if (clean.length > 1 && samePoint(clean[0]!, clean[clean.length - 1]!)) clean.pop();

  let changed = true;
  while (changed && clean.length >= 3) {
    changed = false;
    for (let i = 0; i < clean.length; i += 1) {
      const prev = clean[(i + clean.length - 1) % clean.length]!;
      const cur = clean[i]!;
      const next = clean[(i + 1) % clean.length]!;
      const a = sub(cur, prev);
      const b = sub(next, cur);
      const scaleRef = Math.max(len(a) * len(b), 1);
      if (len(a) <= WORLD_EPS || len(b) <= WORLD_EPS || len(cross(a, b)) <= WORLD_EPS * scaleRef) {
        clean.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return clean;
}

function polygonArea3D(vertices: Vec3[], planeNormal: Vec3): number {
  if (vertices.length < 3) return 0;
  const n = normalize(planeNormal);
  let twiceArea = 0;
  const origin = vertices[0]!;
  for (let i = 1; i + 1 < vertices.length; i += 1) {
    twiceArea += Math.abs(dot(cross(sub(vertices[i]!, origin), sub(vertices[i + 1]!, origin)), n));
  }
  return twiceArea * 0.5;
}

/** Делит выпуклое сечение по линии пересечения с другой плоскостью. */
function splitConvexPolygonByHalfSpace(
  polygon: Vec3[],
  cuttingPlane: PlaneEq,
  polygonPlane: PlaneEq,
  eps = WORLD_EPS,
): Vec3[][] {
  const dists = polygon.map((p) => planePointDistance(p, cuttingPlane));
  const hasPos = dists.some((d) => d > eps);
  const hasNeg = dists.some((d) => d < -eps);
  if (!hasPos || !hasNeg) return [polygon];

  const pos: Vec3[] = [];
  const neg: Vec3[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const cur = polygon[i]!;
    const next = polygon[(i + 1) % polygon.length]!;
    const dc = dists[i]!;
    const dn = dists[(i + 1) % polygon.length]!;
    if (dc >= -eps) pos.push(cur);
    if (dc <= eps) neg.push(cur);
    if ((dc > eps && dn < -eps) || (dc < -eps && dn > eps)) {
      // Одна и та же вершина пересечения должна получаться бит-в-бит одинаковой
      // при разрезании обеих плоскостей и при последующих разрезах.
      const hit = canonicalPoint(add(cur, scale(sub(next, cur), dc / (dc - dn))), eps);
      pos.push(hit);
      neg.push(hit);
    }
  }

  return [pos, neg]
    .map(normalizePolygon)
    .filter((part) => part.length >= 3 && polygonArea3D(part, polygonPlane.normal) > AREA_EPS);
}

export function subdividePlaneSection(
  section: Vec3[],
  planeEq: PlaneEq,
  otherPlaneEqs: PlaneEq[],
): Vec3[][] {
  const scaleRef = polygonScale(section);
  const linearEps = Math.max(WORLD_EPS, scaleRef * 1e-6);
  const areaEps = Math.max(AREA_EPS, scaleRef * scaleRef * 1e-8);
  let fragments: Vec3[][] = [normalizePolygon(section.map((point) => canonicalPoint(point, linearEps)))];
  for (const otherEq of otherPlaneEqs) {
    const next = fragments.flatMap((fragment) =>
      splitConvexPolygonByHalfSpace(fragment, otherEq, planeEq, linearEps),
    );
    if (next.length) fragments = next;
  }
  return fragments.filter(
    (fragment) => fragment.length >= 3 && polygonArea3D(fragment, planeEq.normal) > areaEps,
  );
}

function averageDepth(vertices: Vec3[], project: ScreenProjectFn): number {
  return vertices.reduce((sum, vertex) => sum + project(vertex).depth, 0) / Math.max(vertices.length, 1);
}

type ProjectedFragment = PlaneFillFragment & { screen: ScreenProjectedPoint[] };

function pointInPolygon(point: { x: number; y: number }, polygon: ScreenProjectedPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function segmentIntersection(
  a: ScreenProjectedPoint,
  b: ScreenProjectedPoint,
  c: ScreenProjectedPoint,
  d: ScreenProjectedPoint,
): { x: number; y: number } | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const denominator = abx * cdy - aby * cdx;
  if (Math.abs(denominator) <= SCREEN_EPS) return null;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const t = (acx * cdy - acy * cdx) / denominator;
  const u = (acx * aby - acy * abx) / denominator;
  if (t < -SCREEN_EPS || t > 1 + SCREEN_EPS || u < -SCREEN_EPS || u > 1 + SCREEN_EPS) return null;
  return { x: a.x + t * abx, y: a.y + t * aby };
}

/** Точка внутри общей экранной области двух полигонов. */
function overlapSample(a: ScreenProjectedPoint[], b: ScreenProjectedPoint[]): { x: number; y: number } | null {
  const points: Array<{ x: number; y: number }> = [];
  for (const p of a) if (pointInPolygon(p, b)) points.push(p);
  for (const p of b) if (pointInPolygon(p, a)) points.push(p);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      const hit = segmentIntersection(a[i]!, a[(i + 1) % a.length]!, b[j]!, b[(j + 1) % b.length]!);
      if (hit) points.push(hit);
    }
  }
  if (!points.length) return null;
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

function depthInTriangle(
  point: { x: number; y: number },
  a: ScreenProjectedPoint,
  b: ScreenProjectedPoint,
  c: ScreenProjectedPoint,
): number | null {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denominator) <= SCREEN_EPS) return null;
  const wa = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
  const wb = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;
  const wc = 1 - wa - wb;
  if (wa < -SCREEN_EPS || wb < -SCREEN_EPS || wc < -SCREEN_EPS) return null;
  return wa * a.depth + wb * b.depth + wc * c.depth;
}

function depthAtScreen(point: { x: number; y: number }, polygon: ScreenProjectedPoint[]): number | null {
  for (let i = 1; i + 1 < polygon.length; i += 1) {
    const depth = depthInTriangle(point, polygon[0]!, polygon[i]!, polygon[i + 1]!);
    if (depth !== null) return depth;
  }
  return null;
}

/** Painter's algorithm with pairwise constraints in actual overlapping screen areas. */
function sortFragmentsByProjectedDepth(fragments: ProjectedFragment[]): PlaneFillFragment[] {
  const outgoing = fragments.map(() => new Set<number>());
  const incoming = fragments.map(() => 0);

  for (let i = 0; i < fragments.length; i += 1) {
    for (let j = i + 1; j < fragments.length; j += 1) {
      const a = fragments[i]!;
      const b = fragments[j]!;
      if (a.planeId === b.planeId) continue;
      const sample = overlapSample(a.screen, b.screen);
      if (!sample) continue;
      const da = depthAtScreen(sample, a.screen);
      const db = depthAtScreen(sample, b.screen);
      if (da === null || db === null || Math.abs(da - db) <= DEPTH_EPS) continue;
      const far = da > db ? i : j;
      const near = da > db ? j : i;
      if (!outgoing[far]!.has(near)) {
        outgoing[far]!.add(near);
        incoming[near]! += 1;
      }
    }
  }

  const remaining = new Set(fragments.map((_, index) => index));
  const result: PlaneFillFragment[] = [];
  while (remaining.size) {
    const available = [...remaining]
      .filter((index) => incoming[index] === 0)
      .sort((ia, ib) => {
        const depthDiff = fragments[ib]!.depth - fragments[ia]!.depth;
        return Math.abs(depthDiff) > DEPTH_EPS ? depthDiff : ia - ib;
      });
    // A numerical cycle can only occur at a degenerate/tangent view. Break it deterministically.
    const current = available[0] ?? [...remaining].sort((ia, ib) => fragments[ib]!.depth - fragments[ia]!.depth || ia - ib)[0]!;
    remaining.delete(current);
    result.push(fragments[current]!);
    for (const near of outgoing[current]!) incoming[near]! -= 1;
  }
  return result;
}

/** Фрагменты заливки, отсортированные от дальних к ближним. */
export function collectPlaneFillFragments(
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  project: ScreenProjectFn,
): PlaneFillFragment[] {
  const builtPlanes = data.planes.filter((plane) => plane.built && plane.style.visible);
  const fragments: ProjectedFragment[] = [];

  for (const plane of builtPlanes) {
    const equation = resolved.planes.get(plane.id);
    if (!equation) continue;
    const section = computeFaceOrPlaneSection(
      plane.id,
      figure,
      resolved.points,
      resolved.planes,
      resolved.basis,
    );
    if (!section || section.length < 3) continue;

    const cutters: PlaneEq[] = [];
    for (const other of builtPlanes) {
      if (other.id === plane.id) continue;
      const otherEquation = resolved.planes.get(other.id);
      if (!otherEquation) continue;
      const carrier = intersectPlanes(equation, otherEquation);
      if (!carrier) continue;
      const range = planeIntersectionSegmentRange(
        carrier,
        plane.id,
        other.id,
        figure,
        resolved.points,
        resolved.planes,
        resolved.basis,
      );
      if (range && range.t1 - range.t0 > WORLD_EPS) cutters.push(otherEquation);
    }

    const parts = cutters.length ? subdividePlaneSection(section, equation, cutters) : [section];
    for (const vertices of parts) {
      const screen = vertices.map(project);
      fragments.push({
        planeId: plane.id,
        color: plane.style.color,
        vertices,
        depth: averageDepth(vertices, project),
        screen,
      });
    }
  }

  return sortFragmentsByProjectedDepth(fragments);
}