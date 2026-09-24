import { nextId } from "../shared";
import { formatVertexLabel } from "./parse-vertices";
import type { ProjectionCoeffs } from "./camera";
import {
  PYRAMID_HEIGHT,
  cartesianToLocal,
  localToCartesian,
  pyramidApexCartesian,
  pyramidApexScreenAnchor,
  pyramidBaseVerticesCartesian,
  pyramidBaseRadius,
  pyramidEllipseBaseScreen,
  pyramidFootOnBaseFromWorld,
  pyramidHeight,
} from "./pyramid";
import type {
  PrismConstraints,
  PrismFigure,
  PyramidConstraints,
  PyramidFigure,
  SpaceEdge,
  SpaceFace,
  SpaceVertex,
  Vec3,
} from "./types";
import { add } from "./vec3";

export { PYRAMID_HEIGHT as PRISM_HEIGHT };

/** Рубильник «Прямая»: выкл ≈ вершина пирамиды над центром; вкл ≈ над первой вершиной основания. */
export function prismConstraintsToPyramidProjection(c: PrismConstraints): PyramidConstraints {
  return {
    apexOnCenter: !c.straight,
    equilateral: c.equilateral,
    badAngleDeg: c.badAngleDeg,
  };
}

/** Виртуальная пирамида только для школьной проекции (генераторы, якорь вершины). */
export function prismProjectionPyramid(figure: PrismFigure): PyramidFigure {
  const n = figure.baseLabels.length;
  const pc = prismConstraintsToPyramidProjection(figure.constraints);
  const { apex, base } = {
    apex: pyramidApexCartesian(pc, pyramidBaseRadius(pc), pyramidHeight(pc)),
    base: pyramidBaseVerticesCartesian(n, pyramidBaseRadius(pc)),
  };
  const apexId = "pyr-v-apex";
  const baseIds = figure.baseLabels.map((_, i) => `pyr-v-b${i}`);
  return {
    id: figure.id,
    kind: "pyramid",
    apexLabel: figure.baseLabels[0] ?? "A",
    baseLabels: figure.baseLabels,
    constraints: pc,
    vertices: [
      { id: apexId, label: "S", local: cartesianToLocal(apex), builtin: true },
      ...figure.baseLabels.map((label, i) => ({
        id: baseIds[i]!,
        label,
        local: cartesianToLocal(base[i]!),
        builtin: true as const,
      })),
    ],
    edges: [],
    faces: [],
  };
}

export function prismBaseCartesianFromFigure(figure: PrismFigure): Array<{ x: number; y: number }> {
  const n = figure.baseLabels.length;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i += 1) {
    const p = getPrismVertexCartesian(figure, `prism-v-b${i}`);
    out.push(p ? { x: p.x, y: p.y } : { x: 0, y: 0 });
  }
  return out;
}

export function getPrismVertexCartesian(figure: PrismFigure, vertexId: string): Vec3 | null {
  const v = figure.vertices.find((x) => x.id === vertexId);
  if (!v) return null;
  return localToCartesian(v.local);
}

function prismScreenBase(figure: PrismFigure, coeffs: ProjectionCoeffs): Array<{ x: number; y: number }> {
  return pyramidEllipseBaseScreen(coeffs.orbit, figure.baseLabels.length, coeffs.yawRad);
}

/** Смещение верхнего основания на экране: параллельный перенос от нижнего (A₁ − A). */
export function prismTopScreenOffset(
  figure: PrismFigure,
  coeffs: ProjectionCoeffs,
  baseScr: Array<{ x: number; y: number }>,
): { dx: number; dy: number } {
  const proj = prismProjectionPyramid(figure);
  const anchor = pyramidApexScreenAnchor(proj, coeffs.orbit, baseScr);
  const a0 = baseScr[0] ?? anchor;
  const top0 = { x: anchor.x + coeffs.kwx, y: anchor.y + coeffs.kwy };
  return { dx: top0.x - a0.x, dy: top0.y - a0.y };
}

export function prismHeight(_constraints: PrismConstraints): number {
  return PYRAMID_HEIGHT;
}

export function prismScreenBaseVertices(
  figure: PrismFigure,
  coeffs: ProjectionCoeffs,
): Array<{ x: number; y: number }> {
  return prismScreenBase(figure, coeffs);
}

export function prismFootOnBaseFromWorld(world: Vec3, figure: PrismFigure): { x: number; y: number } | null {
  return pyramidFootOnBaseFromWorld(world, prismProjectionPyramid(figure));
}

export function createPrism(baseLabels: string[], constraints: PrismConstraints): PrismFigure {
  const n = baseLabels.length;
  const R = pyramidBaseRadius(prismConstraintsToPyramidProjection(constraints));
  const H = PYRAMID_HEIGHT;
  const base = pyramidBaseVerticesCartesian(n, R);
  const shift: Vec3 = { x: 0, y: 0, z: H };
  const top = base.map((b) => add(b, shift));

  const baseIds = baseLabels.map((_, i) => `prism-v-b${i}`);
  const topIds = baseLabels.map((_, i) => `prism-v-t${i}`);

  const vertices: SpaceVertex[] = [
    ...baseLabels.map((label, i) => ({
      id: baseIds[i]!,
      label,
      local: cartesianToLocal(base[i]!),
      builtin: true as const,
    })),
    ...baseLabels.map((label, i) => ({
      id: topIds[i]!,
      label: formatVertexLabel(label, 1),
      local: cartesianToLocal(top[i]!),
      builtin: true as const,
    })),
  ];

  const edges: SpaceEdge[] = [];
  for (let i = 0; i < n; i += 1) {
    const bi = baseIds[i]!;
    const bj = baseIds[(i + 1) % n]!;
    const ti = topIds[i]!;
    const tj = topIds[(i + 1) % n]!;
    edges.push({ id: `prism-e-b${i}`, aId: bi, bId: bj, builtin: true });
    edges.push({ id: `prism-e-t${i}`, aId: ti, bId: tj, builtin: true });
    edges.push({ id: `prism-e-l${i}`, aId: bi, bId: ti, builtin: true });
  }

  const faces: SpaceFace[] = [
    { id: "prism-f-base", vertexIds: [...baseIds].reverse(), builtin: true },
    { id: "prism-f-top", vertexIds: [...topIds], builtin: true },
    ...baseIds.map((id, i) => ({
      id: `prism-f-side-${i}`,
      vertexIds: [id, baseIds[(i + 1) % n]!, topIds[(i + 1) % n]!, topIds[i]!],
      builtin: true as const,
    })),
  ];

  return {
    id: nextId("prism"),
    kind: "prism",
    baseLabels,
    constraints: { ...constraints },
    vertices,
    edges,
    faces,
  };
}

export function refreshPrismVertices(figure: PrismFigure): PrismFigure {
  const n = figure.baseLabels.length;
  const R = pyramidBaseRadius(prismConstraintsToPyramidProjection(figure.constraints));
  const base = pyramidBaseVerticesCartesian(n, R);
  const shift: Vec3 = { x: 0, y: 0, z: PYRAMID_HEIGHT };
  const top = base.map((b) => add(b, shift));

  const vertices = figure.vertices.map((v) => {
    if (v.id.startsWith("prism-v-b")) {
      const idx = Number(v.id.replace("prism-v-b", ""));
      if (Number.isFinite(idx) && base[idx]) {
        return { ...v, local: cartesianToLocal(base[idx]!) };
      }
    }
    if (v.id.startsWith("prism-v-t")) {
      const idx = Number(v.id.replace("prism-v-t", ""));
      if (Number.isFinite(idx) && top[idx]) {
        return { ...v, local: cartesianToLocal(top[idx]!) };
      }
    }
    return v;
  });
  return { ...figure, vertices };
}
