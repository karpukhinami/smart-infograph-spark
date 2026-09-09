import { nextId } from "../shared";
import type {
  LocalCoords,
  PyramidConstraints,
  PyramidFigure,
  SpaceEdge,
  SpaceFace,
  SpaceVertex,
} from "./types";

/** Правильный n-угольник в плоскости: A=(0,0), B=(1,0), остальные по кругу. */
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

export function createPyramid(
  apexLabel: string,
  baseLabels: string[],
  constraints: PyramidConstraints,
): PyramidFigure {
  const n = baseLabels.length;
  const base2d = regularBasePolygon2D(n);
  const centroid = baseCentroid2D(base2d);

  const apexId = `pyr-v-apex`;
  const baseIds = baseLabels.map((_, i) => `pyr-v-b${i}`);

  const vertices: SpaceVertex[] = [
    {
      id: apexId,
      label: apexLabel,
      local: { u: centroid.x, v: centroid.y, w: 1 },
      builtin: true,
    },
    ...baseLabels.map((label, i) => ({
      id: baseIds[i]!,
      label,
      local: { u: base2d[i]!.x, v: base2d[i]!.y, w: 0 },
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

/** Бarycentric-style: точка (u,v) на основании w=0 — веер от вершины 0. */
export function baseLocalToFan(
  u: number,
  v: number,
  n: number,
): { tri: [number, number, number]; w: [number, number, number] } | null {
  const base = regularBasePolygon2D(n);
  const p = { x: u, y: v };
  for (let i = 1; i < n - 1; i += 1) {
    const w = barycentric2D(p, base[0]!, base[i]!, base[i + 1]!);
    if (w && w[0] >= -1e-6 && w[1] >= -1e-6 && w[2] >= -1e-6) {
      return { tri: [0, i, i + 1], w };
    }
  }
  return null;
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

export function pyramidApexLocal(figure: PyramidFigure): LocalCoords {
  return figure.vertices.find((v) => v.id.startsWith("pyr-v-apex"))!.local;
}
