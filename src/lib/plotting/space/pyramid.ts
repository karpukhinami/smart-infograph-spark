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

/** Равномерные точки вдоль дуги эллипса from→to; дуга не проходит через avoidPoint (обычно A). */
function ellipseArcEqualPoints(
  orbit: ConicEllipse,
  from: number,
  to: number,
  count: number,
  avoidPoint: { x: number; y: number },
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  const pFrom = ellipsePoint(orbit, from);
  const pTo = ellipsePoint(orbit, to);
  if (count === 1) return [pFrom];

  const walk = (dir: 1 | -1): Array<{ theta: number; s: number; x: number; y: number }> => {
    const out: Array<{ theta: number; s: number; x: number; y: number }> = [];
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

  const score = (table: Array<{ x: number; y: number }>, len: number): number => {
    const d = minDistToAvoid(table);
    if (d < avoidR2) return Infinity;
    return len;
  };

  let table = score(tNeg, lenNeg) <= score(tPos, lenPos) ? tNeg : tPos;
  if ((table[table.length - 1]?.s ?? 0) < 1e-9) table = lenNeg >= lenPos ? tNeg : tPos;

  const total = table[table.length - 1]?.s ?? 0;
  const out: Array<{ x: number; y: number }> = [];
  for (let k = 0; k < count; k += 1) {
    if (k === 0) {
      out.push(pFrom);
      continue;
    }
    if (k === count - 1) {
      out.push(pTo);
      continue;
    }
    if (total < 1e-9) {
      out.push({
        x: pFrom.x + (pTo.x - pFrom.x) * (k / (count - 1)),
        y: pFrom.y + (pTo.y - pFrom.y) * (k / (count - 1)),
      });
      continue;
    }
    const targetS = (total * k) / (count - 1);
    let j = 1;
    while (j < table.length && table[j]!.s < targetS) j += 1;
    const hi = table[j] ?? table[table.length - 1]!;
    const lo = table[j - 1] ?? table[0]!;
    const span = hi.s - lo.s;
    const t = span > 1e-12 ? (targetS - lo.s) / span : 0;
    const p = { x: lo.x + t * (hi.x - lo.x), y: lo.y + t * (hi.y - lo.y) };
    if (dist2(p, avoidPoint) < avoidR2) {
      const bump = (targetS / total) * 0.15 + 0.05;
      const targetS2 = Math.min(total, targetS + bump * total);
      let j2 = 1;
      while (j2 < table.length && table[j2]!.s < targetS2) j2 += 1;
      const hi2 = table[j2] ?? table[table.length - 1]!;
      const lo2 = table[j2 - 1] ?? table[0]!;
      const span2 = hi2.s - lo2.s;
      const t2 = span2 > 1e-12 ? (targetS2 - lo2.s) / span2 : 0;
      out.push({ x: lo2.x + t2 * (hi2.x - lo2.x), y: lo2.y + t2 * (hi2.y - lo2.y) });
    } else {
      out.push(p);
    }
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

/**
 * Экранная позиция точки основания: барицентрика по вершинам (x,y) → baseScr.
 * Гарантирует, что вершина i попадает в baseScr[i] (в отличие от аффинной u,v).
 */
export function pyramidBaseScreenAtXY(
  x: number,
  y: number,
  baseCart: Array<{ x: number; y: number }>,
  baseScr: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  const n = baseCart.length;
  if (n < 3) return baseScr[0] ?? { x: 0, y: 0 };
  const p = { x, y };
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
 * Основание на эллипсе вращения: A = θ_A, B = θ_B, последняя = θ_D;
 * остальные вершины — равномерно по передней дуге B → последняя (как у параллелепипеда).
 */
export function pyramidEllipseBaseScreen(
  orbit: ConicEllipse,
  n: number,
): Array<{ x: number; y: number }> {
  if (n <= 0) return [];
  if (n === 1) return [ellipsePoint(orbit, orbit.thetaA)];
  if (n === 2) {
    return [ellipsePoint(orbit, orbit.thetaA), ellipsePoint(orbit, orbit.thetaB)];
  }
  const a = ellipsePoint(orbit, orbit.thetaA);
  const chain = ellipseArcEqualPoints(orbit, orbit.thetaB, orbit.thetaD, n - 1, a);
  const out = [a, ...chain];
  for (let i = 1; i < out.length; i += 1) {
    if (dist2(out[i]!, a) < 0.015 ** 2) {
      out[i] = ellipsePoint(orbit, orbit.thetaA - (orbit.thetaA - orbit.thetaB) * (i / Math.max(1, n - 1)));
    }
  }
  return out;
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
    { id: "pyr-f-base", vertexIds: [...baseIds], builtin: true },
    ...baseIds.map((id, i) => ({
      id: `pyr-f-side-${i}`,
      vertexIds: [apexId, id, baseIds[(i + 1) % n]!],
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
