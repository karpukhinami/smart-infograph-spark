import { nextId } from "../shared";
import { ellipsePoint, type ConicEllipse } from "./conic-ellipse";
import type {
  LocalCoords,
  PyramidConstraints,
  PyramidFigure,
  SpaceEdge,
  SpaceFace,
  SpaceVertex,
  Vec3,
} from "./types";
import { add, scale, sub, worldToLocal } from "./vec3";

/** В `local` пирамиды: декартовы (x,y,z) в системе с началом в центре основания. */

export const PYRAMID_BASE_RADIUS = 1;
export const PYRAMID_HEIGHT = 2;

export function pyramidBaseRadius(_constraints: PyramidConstraints): number {
  return PYRAMID_BASE_RADIUS;
}

export function pyramidHeight(_constraints: PyramidConstraints): number {
  return PYRAMID_HEIGHT;
}

export function pyramidBaseAngleRad(n: number): number {
  return (2 * Math.PI) / n;
}

/**
 * Вершины основания z=0, против часовой стрелки: 2-я буква → (R,0,0), далее +360/n.
 */
export function pyramidBaseVerticesCartesian(
  n: number,
  radius: number = PYRAMID_BASE_RADIUS,
): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i += 1) {
    const ang = pyramidBaseAngleRad(n) * i;
    out.push({ x: radius * Math.cos(ang), y: radius * Math.sin(ang), z: 0 });
  }
  return out;
}

export function pyramidApexCartesian(
  constraints: PyramidConstraints,
  baseRadius: number = PYRAMID_BASE_RADIUS,
  height: number = PYRAMID_HEIGHT,
): Vec3 {
  if (constraints.apexOnCenter) {
    return { x: 0, y: 0, z: height };
  }
  return { x: baseRadius, y: 0, z: height };
}

export function cartesianToLocal(c: Vec3): LocalCoords {
  return { u: c.x, v: c.y, w: c.z };
}

export function localToCartesian(local: LocalCoords): Vec3 {
  return { x: local.u, y: local.v, z: local.w };
}

export function pyramidVertexCartesianCoords(
  constraints: PyramidConstraints,
  n: number,
): { apex: Vec3; base: Vec3[] } {
  const R = pyramidBaseRadius(constraints);
  const H = pyramidHeight(constraints);
  const base = pyramidBaseVerticesCartesian(n, R);
  const apex = pyramidApexCartesian(constraints, R, H);
  return { apex, base };
}

/** Базис от 2-й вершины основания (A): e1→3-я, e2→последняя, e3→1-я (вершина). */
export interface PyramidABasis {
  A: Vec3;
  B: Vec3;
  last: Vec3;
  S: Vec3;
  e1: Vec3;
  e2: Vec3;
  e3: Vec3;
}

export function getPyramidVertexCartesian(figure: PyramidFigure, vertexId: string): Vec3 | null {
  const v = figure.vertices.find((x) => x.id === vertexId);
  if (!v) return null;
  return localToCartesian(v.local);
}

export function pyramidFrameFromFigure(figure: PyramidFigure): PyramidABasis {
  const n = figure.baseLabels.length;
  const A = getPyramidVertexCartesian(figure, `pyr-v-b0`)!;
  const B = getPyramidVertexCartesian(figure, `pyr-v-b1`)!;
  const last = getPyramidVertexCartesian(figure, `pyr-v-b${n - 1}`)!;
  const S = getPyramidVertexCartesian(figure, `pyr-v-apex`)!;
  const e1 = sub(B, A);
  const e2 = sub(last, A);
  const e3 = sub(S, A);
  return { A, B, last, S, e1, e2, e3 };
}

/** Коэффициенты (u,v,w): P = A + u·e1 + v·e2 + w·e3; у A (0,0,0), B (1,0,0), last (0,1,0), S (0,0,1). */
export function cartesianToPyramidCoeffs(P: Vec3, frame: PyramidABasis): LocalCoords | null {
  return worldToLocal(sub(P, frame.A), { e1: frame.e1, e2: frame.e2, e3: frame.e3 });
}

export function pyramidCoeffsToCartesian(c: LocalCoords, frame: PyramidABasis): Vec3 {
  return add(
    frame.A,
    add(add(scale(frame.e1, c.u), scale(frame.e2, c.v)), scale(frame.e3, c.w)),
  );
}

/** Коэффициенты (u,v) для каждой вершины основания в базисе A. */
export function pyramidBaseVertexCoeffs(
  figure: PyramidFigure,
): Array<{ u: number; v: number }> {
  const frame = pyramidFrameFromFigure(figure);
  const n = figure.baseLabels.length;
  const out: Array<{ u: number; v: number }> = [];
  for (let i = 0; i < n; i += 1) {
    const p = getPyramidVertexCartesian(figure, `pyr-v-b${i}`)!;
    const c = cartesianToPyramidCoeffs(p, frame);
    out.push({ u: c?.u ?? 0, v: c?.v ?? 0 });
  }
  return out;
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

type ArcTable = Array<{ theta: number; s: number; x: number; y: number }>;

function buildEllipseArcTable(
  orbit: ConicEllipse,
  from: number,
  to: number,
  avoidPoint: { x: number; y: number },
  preferLongArc: boolean,
): ArcTable {
  const pFrom = ellipsePoint(orbit, from);
  const pTo = ellipsePoint(orbit, to);

  const walk = (dir: 1 | -1): ArcTable => {
    const out: ArcTable = [];
    let s = 0;
    const step = (dir * 2 * Math.PI) / 4096;
    let theta = from;
    let prev = pFrom;
    out.push({ theta, s: 0, x: prev.x, y: prev.y });
    for (let i = 0; i < 4096; i += 1) {
      theta += step;
      const p = ellipsePoint(orbit, theta);
      s += Math.hypot(p.x - prev.x, p.y - prev.y);
      out.push({ theta, s, x: p.x, y: p.y });
      prev = p;
      if (Math.hypot(p.x - pTo.x, p.y - pTo.y) < 1e-4) break;
    }
    return out;
  };

  const minDistToAvoid = (table: Array<{ x: number; y: number }>): number => {
    let d = Infinity;
    for (const row of table) {
      d = Math.min(d, dist2(row, avoidPoint));
    }
    return d;
  };

  const tPos = walk(1);
  const tNeg = walk(-1);
  const lenPos = tPos[tPos.length - 1]?.s ?? 0;
  const lenNeg = tNeg[tNeg.length - 1]?.s ?? 0;
  const avoidR2 = 0.02 ** 2;
  const valid = (table: ArcTable, len: number) =>
    minDistToAvoid(table) >= avoidR2 && len > 1e-9;

  const candidates: Array<{ table: ArcTable; len: number }> = [];
  if (valid(tPos, lenPos)) candidates.push({ table: tPos, len: lenPos });
  if (valid(tNeg, lenNeg)) candidates.push({ table: tNeg, len: lenNeg });
  if (candidates.length === 0) return lenNeg >= lenPos ? tNeg : tPos;
  if (candidates.length === 1) return candidates[0]!.table;
  candidates.sort((a, b) => (preferLongArc ? b.len - a.len : a.len - b.len));
  return candidates[0]!.table;
}

function thetaOnArcTable(table: ArcTable, frac: number): number {
  const total = table[table.length - 1]?.s ?? 0;
  if (total < 1e-9) return table[0]!.theta;
  const targetS = total * Math.max(0, Math.min(1, frac));
  let j = 1;
  while (j < table.length && table[j]!.s < targetS) j += 1;
  const hi = table[j] ?? table[table.length - 1]!;
  const lo = table[j - 1] ?? table[0]!;
  const span = hi.s - lo.s;
  const t = span > 1e-12 ? (targetS - lo.s) / span : 0;
  return lo.theta + t * (hi.theta - lo.theta);
}

/** Равномерные точки вдоль дуги эллипса from→to; дуга не проходит через avoidPoint (обычно A). */
function ellipseArcEqualPoints(
  orbit: ConicEllipse,
  from: number,
  to: number,
  count: number,
  avoidPoint: { x: number; y: number },
  preferLongArc = false,
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  const pFrom = ellipsePoint(orbit, from);
  const pTo = ellipsePoint(orbit, to);
  if (count === 1) return [pFrom];

  const table = buildEllipseArcTable(orbit, from, to, avoidPoint, preferLongArc);
  const out: Array<{ x: number; y: number }> = [];
  for (let k = 0; k < count; k += 1) {
    if (k === 0) out.push(pFrom);
    else if (k === count - 1) out.push(pTo);
    else out.push(ellipsePoint(orbit, thetaOnArcTable(table, k / (count - 1))));
  }
  return out;
}

/** (x,y) вершин основания из фигуры (декартовы координаты). */
export function pyramidBaseCartesianFromFigure(figure: PyramidFigure): Array<{ x: number; y: number }> {
  const n = figure.baseLabels.length;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i += 1) {
    const p = getPyramidVertexCartesian(figure, `pyr-v-b${i}`);
    out.push(p ? { x: p.x, y: p.y } : { x: 0, y: 0 });
  }
  return out;
}

/** Вершина S в декартовых координатах (центр основания — начало координат). */
export function pyramidApexCartesianFromFigure(figure: PyramidFigure): Vec3 {
  const p = getPyramidVertexCartesian(figure, `pyr-v-apex`);
  if (p) return p;
  return pyramidApexCartesian(figure.constraints);
}

/**
 * Основание Q точки P на луче S→Q (S — вершина, Q на плоскости z=0).
 * P = Q + (z/H)·(S − Q)  ⇒  Q_xy = (P_xy − (z/H)·S_xy) / (1 − z/H).
 */
export function pyramidFootOnBaseFromWorld(
  world: Vec3,
  figure: PyramidFigure,
): { x: number; y: number } | null {
  const H = pyramidHeight(figure.constraints);
  if (H < 1e-9) return null;
  if (world.z <= 1e-8 || world.z >= H - 1e-8) return null;
  const S = pyramidApexCartesianFromFigure(figure);
  const t = world.z / H;
  const lam = 1 - t;
  if (lam < 1e-9) return null;
  return {
    x: (world.x - t * S.x) / lam,
    y: (world.y - t * S.y) / lam,
  };
}

/** Якорь вершины на экране: центр эллипса или первая вершина основания (S над A). */
export function pyramidApexScreenAnchor(
  figure: PyramidFigure,
  orbit: ConicEllipse,
  baseScr: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  if (figure.constraints.apexOnCenter) {
    return { x: orbit.cx, y: orbit.cy };
  }
  return baseScr[0] ?? { x: orbit.cx, y: orbit.cy };
}

/** n вершин основания на эллипсе с равными шагами по длине дуги, начиная с θ₀. */
export function ellipseBaseVerticesEqualArc(
  orbit: ConicEllipse,
  n: number,
  startTheta: number,
  samples = 720,
): Array<{ x: number; y: number }> {
  if (n <= 0) return [];
  if (n === 1) return [ellipsePoint(orbit, startTheta)];

  const arcTable: Array<{ theta: number; s: number; x: number; y: number }> = [];
  let s = 0;
  let prev = ellipsePoint(orbit, startTheta);
  arcTable.push({ theta: startTheta, s: 0, x: prev.x, y: prev.y });

  for (let i = 1; i <= samples; i += 1) {
    const theta = startTheta + (2 * Math.PI * i) / samples;
    const p = ellipsePoint(orbit, theta);
    s += Math.hypot(p.x - prev.x, p.y - prev.y);
    arcTable.push({ theta, s, x: p.x, y: p.y });
    prev = p;
  }
  const total = arcTable[arcTable.length - 1]!.s;
  const step = total / n;
  const out: Array<{ x: number; y: number }> = [];

  for (let k = 0; k < n; k += 1) {
    const target = k * step;
    let j = 1;
    while (j < arcTable.length && arcTable[j]!.s < target) j += 1;
    const hi = arcTable[j] ?? arcTable[arcTable.length - 1]!;
    const lo = arcTable[j - 1] ?? arcTable[0]!;
    const span = hi.s - lo.s;
    const t = span > 1e-12 ? (target - lo.s) / span : 0;
    out.push({
      x: lo.x + t * (hi.x - lo.x),
      y: lo.y + t * (hi.y - lo.y),
    });
  }
  return out;
}

function barycentric2D(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): [number, number, number] | null {
  const v0 = { x: c.x - a.x, y: c.y - a.y };
  const v1 = { x: b.x - a.x, y: b.y - a.y };
  const v2 = { x: p.x - a.x, y: p.y - a.y };
  const den = v0.x * v1.y - v1.x * v0.y;
  if (Math.abs(den) < 1e-12) return null;
  const w1 = (v2.x * v1.y - v1.x * v2.y) / den;
  const w2 = (v0.x * v2.y - v2.x * v0.y) / den;
  const w0 = 1 - w1 - w2;
  return [w0, w1, w2];
}

/** Экранная точка основания: аффинная карта (u,v) в базисе A → экран (как у параллелепипеда). */
export function pyramidBaseScreenFromCoeffs(
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

export function pyramidBaseScreenAtXY(
  x: number,
  y: number,
  baseCart: Array<{ x: number; y: number }>,
  baseScr: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  const n = baseCart.length;
  if (n < 1) return { x: 0, y: 0 };
  const p = { x, y };
  const snap = 1e-5;
  for (let i = 0; i < n; i += 1) {
    const c = baseCart[i]!;
    if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < snap ** 2) {
      return baseScr[i] ?? { x: 0, y: 0 };
    }
  }
  if (n < 3) return baseScr[0] ?? { x: 0, y: 0 };
  const tol = 1e-4;
  for (let i = 1; i < n - 1; i += 1) {
    const w = barycentric2D(p, baseCart[0]!, baseCart[i]!, baseCart[i + 1]!);
    if (w && w[0] >= -tol && w[1] >= -tol && w[2] >= -tol) {
      const [w0, w1, w2] = w;
      return {
        x: w0 * baseScr[0]!.x + w1 * baseScr[i]!.x + w2 * baseScr[i + 1]!.x,
        y: w0 * baseScr[0]!.y + w1 * baseScr[i]!.y + w2 * baseScr[i + 1]!.y,
      };
    }
  }
  let bestDist = Infinity;
  let best: { x: number; y: number } | null = null;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const a = baseCart[i]!;
    const b = baseCart[j]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2)) : 0;
    const qx = a.x + t * abx;
    const qy = a.y + t * aby;
    const d = (p.x - qx) ** 2 + (p.y - qy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = {
        x: baseScr[i]!.x + t * (baseScr[j]!.x - baseScr[i]!.x),
        y: baseScr[i]!.y + t * (baseScr[j]!.y - baseScr[i]!.y),
      };
    }
  }
  return best ?? baseScr[0] ?? { x: 0, y: 0 };
}

/**
 * Вершины основания на эллипсе: полярный угол θ_i = θ_A + i·(2π/n), i=0…n−1,
 * обход **против часовой** (как 3D: A → B → C … от +X).
 */
export function pyramidEllipseBaseScreen(
  orbit: ConicEllipse,
  n: number,
  yawRad = 0,
): Array<{ x: number; y: number }> {
  if (n <= 0) return [];
  const dTheta = pyramidBaseAngleRad(n);
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i += 1) {
    out.push(ellipsePoint(orbit, orbit.thetaA + yawRad + dTheta * i));
  }
  return out;
}

/**
 * Проекция точки на боковом ребре/грани: P = Q + (z/H)(S − Q), Q на основании, S — вершина.
 * Работает и для S над центром (S_xy = 0), и для S над вершиной основания.
 */
export function pyramidProjectOnApexGenerator(
  world: Vec3,
  figure: PyramidFigure,
  baseCart: Array<{ x: number; y: number }>,
  baseScr: Array<{ x: number; y: number }>,
  apexAnchor: { x: number; y: number },
  H: number,
  kwx: number,
  kwy: number,
): { x: number; y: number } | null {
  if (H < 1e-9) return null;
  const foot = pyramidFootOnBaseFromWorld(world, figure);
  if (!foot) return null;
  const bx = foot.x;
  const by = foot.y;
  const tol = 0.04;

  for (let i = 0; i < baseCart.length; i += 1) {
    const c = baseCart[i]!;
    if ((bx - c.x) ** 2 + (by - c.y) ** 2 < tol * tol) {
      const s = baseScr[i]!;
      const t = world.z / H;
      return {
        x: s.x + t * (apexAnchor.x - s.x) + kwx * t,
        y: s.y + t * (apexAnchor.y - s.y) + kwy * t,
      };
    }
  }

  for (let i = 0; i < baseCart.length; i += 1) {
    const j = (i + 1) % baseCart.length;
    const a = baseCart[i]!;
    const b = baseCart[j]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-12) continue;
    const u = ((bx - a.x) * abx + (by - a.y) * aby) / len2;
    if (u < -0.02 || u > 1.02) continue;
    const uu = Math.max(0, Math.min(1, u));
    const px = a.x + uu * abx;
    const py = a.y + uu * aby;
    if ((bx - px) ** 2 + (by - py) ** 2 > tol * tol) continue;
    const sa = baseScr[i]!;
    const sb = baseScr[j]!;
    const s = { x: sa.x + uu * (sb.x - sa.x), y: sa.y + uu * (sb.y - sa.y) };
    const t = world.z / H;
    return {
      x: s.x + t * (apexAnchor.x - s.x) + kwx * t,
      y: s.y + t * (apexAnchor.y - s.y) + kwy * t,
    };
  }
  return null;
}

export function createPyramid(
  apexLabel: string,
  baseLabels: string[],
  constraints: PyramidConstraints,
): PyramidFigure {
  const n = baseLabels.length;
  const { apex, base } = pyramidVertexCartesianCoords(constraints, n);

  const apexId = `pyr-v-apex`;
  const baseIds = baseLabels.map((_, i) => `pyr-v-b${i}`);

  const vertices: SpaceVertex[] = [
    {
      id: apexId,
      label: apexLabel,
      local: cartesianToLocal(apex),
      builtin: true,
    },
    ...baseLabels.map((label, i) => ({
      id: baseIds[i]!,
      label,
      local: cartesianToLocal(base[i]!),
      builtin: true,
    })),
  ];

  const edges: SpaceEdge[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = baseIds[i]!;
    const b = baseIds[(i + 1) % n]!;
    edges.push({ id: `pyr-e-b${i}`, aId: a, bId: b, builtin: true });
    edges.push({ id: `pyr-e-s${i}`, aId: apexId, bId: a, builtin: true });
  }

  const faces: SpaceFace[] = [
    { id: "pyr-f-base", vertexIds: [...baseIds].reverse(), builtin: true },
    ...baseIds.map((id, i) => ({
      id: `pyr-f-side-${i}`,
      vertexIds: [apexId, baseIds[(i + 1) % n]!, id],
      builtin: true as const,
    })),
  ];

  return {
    id: nextId("pyr"),
    kind: "pyramid",
    apexLabel,
    baseLabels,
    constraints: { ...constraints },
    vertices,
    edges,
    faces,
  };
}

export function pyramidApexLocal(figure: PyramidFigure): LocalCoords {
  const { apex } = pyramidVertexCartesianCoords(figure.constraints, figure.baseLabels.length);
  return cartesianToLocal(apex);
}

export function refreshPyramidVertices(figure: PyramidFigure): PyramidFigure {
  const n = figure.baseLabels.length;
  const { apex, base } = pyramidVertexCartesianCoords(figure.constraints, n);
  const vertices = figure.vertices.map((v) => {
    if (v.id.startsWith("pyr-v-apex")) {
      return { ...v, local: cartesianToLocal(apex) };
    }
    const idx = Number(v.id.replace("pyr-v-b", ""));
    if (Number.isFinite(idx) && base[idx]) {
      return { ...v, local: cartesianToLocal(base[idx]!) };
    }
    return v;
  });
  return { ...figure, vertices };
}
