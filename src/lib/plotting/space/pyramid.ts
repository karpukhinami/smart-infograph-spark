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

/** Для пирамиды в `local` хранится декартова (x,y,z): u=x, v=y, w=z; начало — центр основания. */

export const PYRAMID_DEFAULT_BASE_RADIUS = 1.1;

export function pyramidBaseRadius(constraints: PyramidConstraints): number {
  const L = PYRAMID_DEFAULT_BASE_RADIUS;
  return constraints.equilateral ? L : L;
}

/** Высота: в 2 раза больше радиуса основания (длина «базового» вектора от центра к вершине). */
export function pyramidHeight(constraints: PyramidConstraints): number {
  return 2 * pyramidBaseRadius(constraints);
}

export function pyramidBaseAngleRad(n: number): number {
  return (2 * Math.PI) / n;
}

/** Вершины основания в плоскости z=0; ось X — к 2-й букве (индекс 0), угол 2π/n. */
export function pyramidBaseVerticesCartesian(
  n: number,
  radius: number,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i += 1) {
    const ang = pyramidBaseAngleRad(n) * i;
    out.push({ x: radius * Math.cos(ang), y: radius * Math.sin(ang) });
  }
  return out;
}

export function pyramidApexCartesian(
  constraints: PyramidConstraints,
  baseRadius: number,
  height: number,
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
  const base2d = pyramidBaseVerticesCartesian(n, R);
  const base = base2d.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  const apex = pyramidApexCartesian(constraints, R, H);
  return { apex, base };
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

export function barycentric2D(
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

/** Точка (x,y) внутри основания — веер от вершины 0. */
export function pointInBasePolygon2D(
  x: number,
  y: number,
  baseXY: Array<{ x: number; y: number }>,
): boolean {
  const n = baseXY.length;
  if (n < 3) return false;
  const p = { x, y };
  for (let i = 1; i < n - 1; i += 1) {
    const w = barycentric2D(p, baseXY[0]!, baseXY[i]!, baseXY[i + 1]!);
    if (w && w[0] >= -1e-6 && w[1] >= -1e-6 && w[2] >= -1e-6) return true;
  }
  return false;
}

/** Экранная позиция точки основания по барицентрической интерполяции вершин. */
export function pyramidBaseScreenAtXY(
  x: number,
  y: number,
  baseXY: Array<{ x: number; y: number }>,
  baseScr: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  const n = baseXY.length;
  if (n < 3) return baseScr[0] ?? { x: 0, y: 0 };
  const p = { x, y };
  for (let i = 1; i < n - 1; i += 1) {
    const w = barycentric2D(p, baseXY[0]!, baseXY[i]!, baseXY[i + 1]!);
    if (w && w[0] >= -1e-6 && w[1] >= -1e-6 && w[2] >= -1e-6) {
      const [w0, w1, w2] = w;
      return {
        x: w0 * baseScr[0]!.x + w1 * baseScr[i]!.x + w2 * baseScr[i + 1]!.x,
        y: w0 * baseScr[0]!.y + w1 * baseScr[i]!.y + w2 * baseScr[i + 1]!.y,
      };
    }
  }
  return baseScr[0] ?? { x: 0, y: 0 };
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

/** Пересчитать декартовы координаты вершин после смены ограничений. */
export function refreshPyramidVertices(figure: PyramidFigure): PyramidFigure {
  const n = figure.baseLabels.length;
  const { apex, base } = pyramidVertexCartesianCoords(figure.constraints, n);
  const vertices = figure.vertices.map((v) => {
    if (v.id === "pyr-v-apex" || v.id.startsWith("pyr-v-apex")) {
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
