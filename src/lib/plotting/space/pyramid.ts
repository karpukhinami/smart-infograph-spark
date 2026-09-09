import { nextId } from "../shared";
import { ellipsePoint, type ConicEllipse } from "./conic-ellipse";
import type {
  LocalCoords,
  PyramidConstraints,
  PyramidFigure,
  SpaceEdge,
  SpaceFace,
  SpaceVertex,
} from "./types";

/** Правильный n-угольник в плоскости XY: v0=(0,0), |v1−v0|=1. */
export function regularBasePolygon2D(n: number): Array<{ x: number; y: number }> {
  const raw: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i += 1) {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    raw.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  const dx = raw[1]!.x - raw[0]!.x;
  const dy = raw[1]!.y - raw[0]!.y;
  const scale = 1 / Math.hypot(dx, dy);
  const ox = raw[0]!.x;
  const oy = raw[0]!.y;
  return raw.map((p) => ({
    x: (p.x - ox) * scale,
    y: (p.y - oy) * scale,
  }));
}

function solve2DInBasis(
  e1x: number,
  e1y: number,
  e2x: number,
  e2y: number,
  px: number,
  py: number,
): { u: number; v: number } {
  const det = e1x * e2y - e1y * e2x;
  if (Math.abs(det) < 1e-12) return { u: px, v: py };
  return {
    u: (px * e2y - py * e2x) / det,
    v: (e1x * py - e1y * px) / det,
  };
}

/**
 * Локальные коэффициенты вершин основания и вершины пирамиды.
 * Базис от 2-й буквы (первая вершина основания): e1→3-я, e2→последняя, e3→1-я (вершина).
 * Фиксировано: A=(0,0,0), B=(1,0,0), last=(0,1,0), apex=(0,0,1).
 */
export function pyramidVertexLocalCoords(n: number): LocalCoords[] {
  const pts = regularBasePolygon2D(n);
  const e1x = pts[1]!.x - pts[0]!.x;
  const e1y = pts[1]!.y - pts[0]!.y;
  const e2x = pts[n - 1]!.x - pts[0]!.x;
  const e2y = pts[n - 1]!.y - pts[0]!.y;

  const base: LocalCoords[] = pts.map((p) => {
    const { u, v } = solve2DInBasis(e1x, e1y, e2x, e2y, p.x, p.y);
    return { u, v, w: 0 };
  });
  return [...base, { u: 0, v: 0, w: 1 }];
}

export function pyramidBaseUV(n: number): Array<{ u: number; v: number }> {
  return pyramidVertexLocalCoords(n)
    .slice(0, n)
    .map(({ u, v }) => ({ u, v }));
}

export function baseCentroidUV(n: number): { u: number; v: number } {
  const base = pyramidBaseUV(n);
  let su = 0;
  let sv = 0;
  for (const p of base) {
    su += p.u;
    sv += p.v;
  }
  return { u: su / n, v: sv / n };
}

export function baseCentroid2D(base: Array<{ x: number; y: number }>): { x: number; y: number } {
  const n = base.length;
  if (!n) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of base) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / n, y: sy / n };
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

export function createPyramid(
  apexLabel: string,
  baseLabels: string[],
  constraints: PyramidConstraints,
): PyramidFigure {
  const n = baseLabels.length;
  const locals = pyramidVertexLocalCoords(n);
  const apexLocal = locals[n]!;

  const apexId = `pyr-v-apex`;
  const baseIds = baseLabels.map((_, i) => `pyr-v-b${i}`);

  const vertices: SpaceVertex[] = [
    {
      id: apexId,
      label: apexLabel,
      local: { ...apexLocal },
      builtin: true,
    },
    ...baseLabels.map((label, i) => ({
      id: baseIds[i]!,
      label,
      local: { ...locals[i]! },
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
  return [w0, w2, w1];
}

/** Точка (u,v) внутри основания — веер от первой вершины основания. */
export function baseLocalToFan(
  u: number,
  v: number,
  n: number,
): { tri: [number, number, number]; w: [number, number, number] } | null {
  return baseLocalToFanFromUV(u, v, pyramidBaseUV(n));
}

export function baseLocalToFanFromUV(
  u: number,
  v: number,
  baseUV: Array<{ u: number; v: number }>,
): { tri: [number, number, number]; w: [number, number, number] } | null {
  const n = baseUV.length;
  if (n < 3) return null;
  const p = { x: u, y: v };
  for (let i = 1; i < n - 1; i += 1) {
    const w = barycentric2D(p, baseUV[0]!, baseUV[i]!, baseUV[i + 1]!);
    if (w && w[0] >= -1e-6 && w[1] >= -1e-6 && w[2] >= -1e-6) {
      return { tri: [0, i, i + 1], w };
    }
  }
  return null;
}

export function pyramidApexLocal(_figure: PyramidFigure): LocalCoords {
  return { u: 0, v: 0, w: 1 };
}

export function pyramidBaseAngleRad(n: number): number {
  return (2 * Math.PI) / n;
}
