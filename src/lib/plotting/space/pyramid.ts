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

/** Экранная точка основания: A_scr + u·(B_scr−A_scr) + v·(last_scr−A_scr). */
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
