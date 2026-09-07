import {
  add,
  computeBasis,
  cross,
  dot,
  faceNormal,
  len,
  linePlaneIntersection,
  intersectPlanes,
  localToWorld,
  lerp,
  normalize,
  paramOnLine,
  planeFromPoints,
  planePointDistance,
  pointOnLineParam,
  scale,
  segmentPlaneIntersection,
  sub,
  worldToLocal,
  type PlaneEq,
} from "./vec3";
import { projectFromLocalCoeffs, viewDirection, type ProjectedPoint } from "./camera";
import { faceById, vertexById } from "./parallelepiped";
import type {
  BuiltSpacePoint,
  LineRegion,
  ParallelepipedFigure,
  PointOnLineDefinition,
  SpaceLine,
  SpaceLineDefinition,
  SpacePlane,
  SpacePlaneDefinition,
  SpacePoint,
  SpaceSceneData,
  SpaceViewParams,
  Vec3,
} from "./types";

export interface ResolvedSpaceScene {
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 };
  points: Map<string, BuiltSpacePoint>;
  projected: Map<string, ProjectedPoint>;
  planes: Map<string, PlaneEq>;
  lineErrors: Map<string, string>;
  planeErrors: Map<string, string>;
  pointErrors: Map<string, string>;
  errors: string[];
}

function defaultLineParam(region: LineRegion): number {
  switch (region) {
    case "before":
      return -0.3;
    case "between":
      return 0.4;
    case "after":
      return 1.35;
  }
}

function ratioToParam(region: LineRegion, ratioA: number, ratioB: number): number {
  const m = Math.max(ratioA, 1e-6);
  const n = Math.max(ratioB, 1e-6);
  if (region === "between") return m / (m + n);
  if (region === "before") return -m / n;
  return 1 + m / n;
}

function clampRegionParam(region: LineRegion, t: number): number {
  if (region === "between") return Math.min(0.98, Math.max(0.02, t));
  if (region === "before") return Math.min(-0.02, t);
  return Math.max(1.02, t);
}

function resolveOnLineParam(def: PointOnLineDefinition): number {
  if (def.ratioMode === "explicit") {
    return ratioToParam(def.region, def.ratioA, def.ratioB);
  }
  return def.lineParam ?? defaultLineParam(def.region);
}

function facePoint(
  figure: ParallelepipedFigure,
  points: Map<string, BuiltSpacePoint>,
  faceId: string,
  u: number,
  v: number,
): Vec3 | null {
  const face = faceById(figure, faceId);
  if (!face) return null;
  const verts = face.vertexIds.map((id) => points.get(id)?.world).filter(Boolean) as Vec3[];
  if (verts.length !== 4) return null;
  const [p0, p1, p2, p3] = verts;
  const bottom = lerp(p0!, p1!, u);
  const top = lerp(p3!, p2!, u);
  return lerp(bottom, top, v);
}

function resolvePoint(
  point: SpacePoint,
  figure: ParallelepipedFigure,
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 },
  resolved: Map<string, BuiltSpacePoint>,
): { built: BuiltSpacePoint | null; error: string | null } {
  const def = point.definition;
  if (def.kind === "builtin") {
    const vertex = vertexById(figure, def.vertexId);
    if (!vertex) return { built: null, error: "Вершина не найдена." };
    const world = localToWorld(vertex.local, basis);
    return { built: { local: { ...vertex.local }, world }, error: null };
  }

  if (def.kind === "onLine") {
    const a = resolved.get(def.pointAId);
    const b = resolved.get(def.pointBId);
    if (!a || !b) return { built: null, error: "Опорные точки не найдены." };
    const t = resolveOnLineParam(def);
    const world = pointOnLineParam(a.world, b.world, t);
    const local = worldToLocal(world, basis);
    if (!local) return { built: null, error: "Не удалось вычислить координаты точки." };
    return { built: { local, world }, error: null };
  }

  if (def.kind === "onFace") {
    if (def.placement === "center") {
      const face = faceById(figure, def.faceId);
      if (!face) return { built: null, error: "Грань не найдена." };
      const verts = face.vertexIds
        .map((id) => resolved.get(id)?.world)
        .filter(Boolean) as Vec3[];
      if (verts.length !== 4) return { built: null, error: "Грань не построена." };
      const world = scale(
        verts.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }),
        0.25,
      );
      const local = worldToLocal(world, basis);
      if (!local) return { built: null, error: "Не удалось вычислить координаты точки." };
      return { built: { local, world }, error: null };
    }
    const world = facePoint(figure, resolved, def.faceId, def.faceU, def.faceV);
    if (!world) return { built: null, error: "Грань не найдена." };
    const local = worldToLocal(world, basis);
    if (!local) return { built: null, error: "Не удалось вычислить координаты точки." };
    return { built: { local, world }, error: null };
  }

  return { built: null, error: "Неизвестный способ задания точки." };
}

function lineDirectionFromPoints(a: Vec3, b: Vec3): { origin: Vec3; dir: Vec3 } | null {
  const dir = sub(b, a);
  if (len(dir) < 1e-9) return null;
  return { origin: a, dir: normalize(dir) };
}

function resolvePlane(
  plane: SpacePlane,
  figure: ParallelepipedFigure,
  points: Map<string, BuiltSpacePoint>,
  lines: SpaceLine[],
  planeEqs: Map<string, PlaneEq>,
): { eq: PlaneEq | null; error: string | null } {
  const def = plane.definition;

  if (def.kind === "threePoints") {
    const a = points.get(def.aId)?.world;
    const b = points.get(def.bId)?.world;
    const c = points.get(def.cId)?.world;
    if (!a || !b || !c) return { eq: null, error: "Точки плоскости не найдены." };
    const eq = planeFromPoints(a, b, c);
    if (!eq) return { eq: null, error: "Точки коллинеарны — плоскость не определена." };
    return { eq, error: null };
  }

  if (def.kind === "pointAndLine") {
    const p = points.get(def.pointId)?.world;
    const line = lines.find((l) => l.id === def.lineId);
    if (!p || !line) return { eq: null, error: "Точка или прямая не найдены." };
    const carrier = resolveLineCarrier(line, figure, points, planeEqs, lines);
    if (!carrier) return { eq: null, error: "Прямая не определена." };
    const eq = planeFromPoints(p, carrier.origin, add(carrier.origin, carrier.dir));
    if (!eq) return { eq: null, error: "Точка лежит на прямой — плоскость не определена." };
    return { eq, error: null };
  }

  if (def.kind === "twoLines") {
    const cA = resolveLineCarrier(
      lines.find((l) => l.id === def.lineAId)!,
      figure,
      points,
      planeEqs,
      lines,
    );
    const cB = resolveLineCarrier(
      lines.find((l) => l.id === def.lineBId)!,
      figure,
      points,
      planeEqs,
      lines,
    );
    if (!cA || !cB) return { eq: null, error: "Прямые не найдены." };
    const crossDir = cross(cA.dir, cB.dir);
    if (len(crossDir) < 1e-6) {
      const diff = sub(cB.origin, cA.origin);
      const eq = planeFromPoints(cA.origin, add(cA.origin, cA.dir), add(cA.origin, diff));
      if (!eq) return { eq: null, error: "Прямые совпадают — плоскость не единственна." };
      if (len(cross(diff, cA.dir)) < 1e-6) return { eq: null, error: "Прямые совпадают — плоскость не единственна." };
      return { eq, error: null };
    }
    const eq = planeFromPoints(cA.origin, add(cA.origin, cA.dir), add(cA.origin, crossDir));
    if (!eq) return { eq: null, error: "Не удалось построить плоскость." };
    return { eq, error: null };
  }

  if (def.kind === "lineParallelToLine") {
    const through = resolveLineCarrier(
      lines.find((l) => l.id === def.throughLineId)!,
      figure,
      points,
      planeEqs,
      lines,
    );
    const parallel = resolveLineCarrier(
      lines.find((l) => l.id === def.parallelToLineId)!,
      figure,
      points,
      planeEqs,
      lines,
    );
    if (!through || !parallel) return { eq: null, error: "Прямые не найдены." };
    const eq = planeFromPoints(
      through.origin,
      add(through.origin, through.dir),
      add(through.origin, parallel.dir),
    );
    if (!eq) return { eq: null, error: "Направления совпадают с прямой — плоскость не определена." };
    return { eq, error: null };
  }

  return { eq: null, error: "Неизвестный способ задания плоскости." };
}

export function resolveLineCarrier(
  line: SpaceLine,
  figure: ParallelepipedFigure,
  points: Map<string, BuiltSpacePoint>,
  planeEqs: Map<string, PlaneEq>,
  allLines: SpaceLine[],
): { origin: Vec3; dir: Vec3 } | null {
  const def = line.definition;
  if (def.kind === "twoPoints") {
    const a = points.get(def.aId)?.world;
    const b = points.get(def.bId)?.world;
    if (!a || !b) return null;
    return lineDirectionFromPoints(a, b);
  }
  if (def.kind === "planeIntersection") {
    const pA = planeEqs.get(def.planeAId);
    const pB = planeEqs.get(def.planeBId);
    if (!pA || !pB) return null;
    return intersectPlanes(pA, pB);
  }
  return null;
}

export function buildSpaceScene(data: SpaceSceneData): ResolvedSpaceScene {
  const errors: string[] = [];
  const pointErrors = new Map<string, string>();
  const lineErrors = new Map<string, string>();
  const planeErrors = new Map<string, string>();
  const points = new Map<string, BuiltSpacePoint>();
  const projected = new Map<string, ProjectedPoint>();
  const planes = new Map<string, PlaneEq>();

  if (!data.figure) {
    return {
      basis: computeBasis({ rectangular: false, equilateral: false }),
      points,
      projected,
      planes,
      lineErrors,
      planeErrors,
      pointErrors,
      errors,
    };
  }

  const basis = computeBasis(data.figure.constraints);

  // Встроенные вершины.
  for (const vertex of data.figure.vertices) {
    const world = localToWorld(vertex.local, basis);
    points.set(vertex.id, { local: { ...vertex.local }, world });
  }

  // Пользовательские точки — несколько проходов для зависимостей.
  const pending = [...data.points];
  for (let pass = 0; pass < pending.length + 2 && pending.length; pass += 1) {
    const next: SpacePoint[] = [];
    for (const point of pending) {
      const result = resolvePoint(point, data.figure, basis, points);
      if (result.built) {
        points.set(point.id, result.built);
      } else if (point.lastBuilt) {
        points.set(point.id, point.lastBuilt);
        if (result.error) pointErrors.set(point.id, result.error);
      } else if (result.error) {
        pointErrors.set(point.id, result.error);
        next.push(point);
      }
    }
    if (next.length === pending.length) break;
    pending.splice(0, pending.length, ...next);
  }

  // Грани параллелепипеда как плоскости (для пересечений и выбора в UI).
  for (const face of data.figure.faces) {
    const eq = facePlane(data.figure, face.id, points);
    if (eq) planes.set(face.id, eq);
  }

  // Плоскости — два прохода (пересечения прямых могут зависеть от плоскостей).
  for (let pass = 0; pass < 2; pass += 1) {
    for (const plane of data.planes) {
      const result = resolvePlane(plane, data.figure, points, data.lines, planes);
      if (result.eq) planes.set(plane.id, result.eq);
      else if (result.error) planeErrors.set(plane.id, result.error);
    }
  }

  for (const line of data.lines) {
    const carrier = resolveLineCarrier(line, data.figure, points, planes, data.lines);
    if (!carrier) lineErrors.set(line.id, "Прямая не определена.");
  }

  for (const [id, pt] of points) {
    projected.set(id, projectFromLocalCoeffs(pt.local, pt.world, data.view));
  }

  return { basis, points, projected, planes, lineErrors, planeErrors, pointErrors, errors };
}

export function getPointLabel(
  pointId: string,
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
): string {
  const vertex = figure.vertices.find((v) => v.id === pointId);
  if (vertex) return vertex.label;
  const custom = data.points.find((p) => p.id === pointId);
  return custom?.label ?? "?";
}

export function computeLineDisplayRange(
  carrier: { origin: Vec3; dir: Vec3 },
  points: Map<string, BuiltSpacePoint>,
  tMin: number,
  tMax: number,
  extension: number,
): { t0: number; t1: number } {
  let lo = tMin;
  let hi = tMax;
  for (const pt of points.values()) {
    const t = dot(sub(pt.world, carrier.origin), carrier.dir);
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
  }
  return { t0: lo - extension, t1: hi + extension };
}

/** Точка внутри выпуклого четырёхугольника в 3D. */
function pointInPolygon3D(p: Vec3, polygon: Vec3[]): boolean {
  if (polygon.length < 3) return false;
  const v0 = polygon[0]!;
  const v1 = polygon[1]!;
  const v2 = polygon[2]!;
  const n = cross(sub(v1, v0), sub(v2, v0));
  if (len(n) < 1e-9) return false;
  const nn = normalize(n);
  if (Math.abs(dot(sub(p, v0), nn)) > 1e-4) return false;
  const e1 = sub(v1, v0);
  const e2 = sub(polygon[polygon.length === 4 ? 3 : 2]!, v0);
  const a = dot(e1, e1);
  const b = dot(e1, e2);
  const c = dot(e2, e2);
  const toP = sub(p, v0);
  const d = dot(e1, toP);
  const e = dot(e2, toP);
  const denom = a * c - b * b;
  if (Math.abs(denom) < 1e-9) return false;
  const u = (d * c - b * e) / denom;
  const v = (a * e - b * d) / denom;
  return u >= -0.02 && v >= -0.02 && u + v <= 1.02;
}

/** Отрезок пересечения линии с выпуклым многоугольником в 3D. */
export function clipLineToConvexPolygon(
  origin: Vec3,
  dir: Vec3,
  polygon: Vec3[],
): { t0: number; t1: number } | null {
  if (polygon.length < 2) return null;
  const ts = polygon.map((v) => dot(sub(v, origin), dir));
  let tMin = Math.min(...ts);
  let tMax = Math.max(...ts);
  if (!(tMax - tMin > 1e-9)) return null;
  const samples = 48;
  const inside: number[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = tMin + ((tMax - tMin) * i) / samples;
    const p = add(origin, scale(dir, t));
    if (pointInPolygon3D(p, polygon)) inside.push(t);
  }
  if (!inside.length) return null;
  return { t0: Math.min(...inside), t1: Math.max(...inside) };
}

/** @deprecated используйте clipLineToConvexPolygon */
export function clipLineToPolygon(
  origin: Vec3,
  dir: Vec3,
  polygon: Vec3[],
): { t0: number; t1: number } | null {
  if (polygon.length < 2) return null;
  const ts = polygon.map((v) => dot(sub(v, origin), dir));
  return { t0: Math.min(...ts), t1: Math.max(...ts) };
}

/** Отрезок пересечения двух плоскостей внутри их сечений с параллелепипедом. */
export function planeIntersectionSegmentRange(
  carrier: { origin: Vec3; dir: Vec3 },
  planeAId: string,
  planeBId: string,
  figure: ParallelepipedFigure,
  points: Map<string, BuiltSpacePoint>,
  planeEqs: Map<string, PlaneEq>,
): { t0: number; t1: number } | null {
  const sectionA = computeFaceOrPlaneSection(planeAId, figure, points, planeEqs);
  const sectionB = computeFaceOrPlaneSection(planeBId, figure, points, planeEqs);
  if (!sectionA?.length || !sectionB?.length) return null;
  const clipA = clipLineToConvexPolygon(carrier.origin, carrier.dir, sectionA);
  const clipB = clipLineToConvexPolygon(carrier.origin, carrier.dir, sectionB);
  if (!clipA || !clipB) return null;
  const t0 = Math.max(clipA.t0, clipB.t0);
  const t1 = Math.min(clipA.t1, clipB.t1);
  if (t1 - t0 < 1e-6) return null;
  return { t0, t1 };
}

function computeFaceOrPlaneSection(
  id: string,
  figure: ParallelepipedFigure,
  points: Map<string, BuiltSpacePoint>,
  planeEqs: Map<string, PlaneEq>,
): Vec3[] | null {
  const eq = planeEqs.get(id);
  if (!eq) return null;
  const hits: Vec3[] = [];
  const seen = new Set<string>();
  const key = (p: Vec3) => `${p.x.toFixed(4)}:${p.y.toFixed(4)}:${p.z.toFixed(4)}`;
  for (const edge of figure.edges) {
    const a = points.get(edge.aId)?.world;
    const b = points.get(edge.bId)?.world;
    if (!a || !b) continue;
    const da = planePointDistance(a, eq);
    const db = planePointDistance(b, eq);
    if (Math.abs(da) < 1e-5 && !seen.has(key(a))) {
      seen.add(key(a));
      hits.push(a);
    }
    if (Math.abs(db) < 1e-5 && !seen.has(key(b))) {
      seen.add(key(b));
      hits.push(b);
    }
    if (da * db < -1e-10) {
      const p = lerp(a, b, da / (da - db));
      const k = key(p);
      if (!seen.has(k)) {
        seen.add(k);
        hits.push(p);
      }
    }
  }
  if (hits.length < 3) return hits.length ? hits : null;
  const cx = hits.reduce((s, p) => s + p.x, 0) / hits.length;
  const cy = hits.reduce((s, p) => s + p.y, 0) / hits.length;
  const cz = hits.reduce((s, p) => s + p.z, 0) / hits.length;
  return [...hits].sort((p1, p2) => {
    const a1 = Math.atan2(p1.y - cy, p1.x - cx);
    const a2 = Math.atan2(p2.y - cy, p2.x - cx);
    return a1 - a2;
  });
}

export function facePlane(
  figure: ParallelepipedFigure,
  faceId: string,
  points: Map<string, BuiltSpacePoint>,
): PlaneEq | null {
  const face = faceById(figure, faceId);
  if (!face) return null;
  const a = points.get(face.vertexIds[0]!)?.world;
  const b = points.get(face.vertexIds[1]!)?.world;
  const c = points.get(face.vertexIds[2]!)?.world;
  if (!a || !b || !c) return null;
  return planeFromPoints(a, b, c);
}

export function isPointInsideParallelepiped(
  p: Vec3,
  figure: ParallelepipedFigure,
  points: Map<string, BuiltSpacePoint>,
): boolean {
  for (const face of figure.faces) {
    const plane = facePlane(figure, face.id, points);
    if (!plane) continue;
    const center = face.vertexIds
      .map((id) => points.get(id)?.world)
      .filter(Boolean) as Vec3[];
    if (center.length < 3) continue;
    const c = scale(
      center.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }),
      1 / center.length,
    );
    const sign = Math.sign(planePointDistance(c, plane));
    const d = planePointDistance(p, plane);
    if (sign !== 0 && sign * d > 1e-6) return false;
  }
  return true;
}

export function outwardFaceNormal(
  faceVertexIds: string[],
  points: Map<string, BuiltSpacePoint>,
  bodyCenter: Vec3,
): Vec3 | null {
  const verts = faceVertexIds.map((id) => points.get(id)?.world).filter(Boolean) as Vec3[];
  if (verts.length < 3) return null;
  let n = faceNormal(verts[0]!, verts[1]!, verts[2]!);
  const center = scale(
    verts.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }),
    1 / verts.length,
  );
  if (dot(n, sub(center, bodyCenter)) < 0) n = scale(n, -1);
  return n;
}

export function edgeVisible(
  aId: string,
  bId: string,
  figure: ParallelepipedFigure,
  points: Map<string, BuiltSpacePoint>,
  view: SpaceViewParams,
): boolean {
  const toCamera = viewDirection(view);
  const verts = figure.vertices
    .map((v) => points.get(v.id)?.world)
    .filter(Boolean) as Vec3[];
  const bodyCenter = verts.length
    ? scale(
        verts.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }),
        1 / verts.length,
      )
    : { x: 0, y: 0, z: 0 };

  const adjacent = figure.faces.filter(
    (f) => f.vertexIds.includes(aId) && f.vertexIds.includes(bId),
  );
  for (const face of adjacent) {
    const n = outwardFaceNormal(face.vertexIds, points, bodyCenter);
    if (n && dot(n, toCamera) > 1e-6) return true;
  }
  return false;
}

export { clampRegionParam, defaultLineParam, ratioToParam, resolveOnLineParam, segmentPlaneIntersection };
