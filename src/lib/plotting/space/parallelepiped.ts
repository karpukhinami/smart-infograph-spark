import { nextId } from "../shared";
import { formatVertexLabel } from "./parse-vertices";
import type {
  LocalCoords,
  ParallelepipedConstraints,
  ParallelepipedFigure,
  SpaceEdge,
  SpaceFace,
  SpaceVertex,
} from "./types";

/** Топология параллелепипеда: 8 вершин, 12 рёбер, 6 граней со стабильными ID. */
export function createParallelepiped(
  baseLabels: [string, string, string, string],
  constraints: ParallelepipedConstraints = { rectangular: true, equilateral: false, badAngleDeg: 90 },
): ParallelepipedFigure {
  const [a, b, c, d] = baseLabels;
  const labels = {
    A: a,
    B: b,
    C: c,
    D: d,
    A1: formatVertexLabel(a, 1),
    B1: formatVertexLabel(b, 1),
    C1: formatVertexLabel(c, 1),
    D1: formatVertexLabel(d, 1),
  };

  const coords: Record<string, LocalCoords> = {
    A: { u: 0, v: 0, w: 0 },
    B: { u: 1, v: 0, w: 0 },
    D: { u: 0, v: 1, w: 0 },
    C: { u: 1, v: 1, w: 0 },
    A1: { u: 0, v: 0, w: 1 },
    B1: { u: 1, v: 0, w: 1 },
    D1: { u: 0, v: 1, w: 1 },
    C1: { u: 1, v: 1, w: 1 },
  };

  const keys = ["A", "B", "C", "D", "A1", "B1", "C1", "D1"] as const;
  const vertices: SpaceVertex[] = keys.map((key) => ({
    id: `pp-v-${key}`,
    label: labels[key],
    local: coords[key]!,
    builtin: true,
  }));

  const byKey = Object.fromEntries(vertices.map((v, i) => [keys[i], v.id])) as Record<
    (typeof keys)[number],
    string
  >;

  const edgePairs: Array<[string, string, string]> = [
    ["e-ab", byKey.A, byKey.B],
    ["e-bc", byKey.B, byKey.C],
    ["e-cd", byKey.C, byKey.D],
    ["e-da", byKey.D, byKey.A],
    ["e-a1b1", byKey.A1, byKey.B1],
    ["e-b1c1", byKey.B1, byKey.C1],
    ["e-c1d1", byKey.C1, byKey.D1],
    ["e-d1a1", byKey.D1, byKey.A1],
    ["e-aa1", byKey.A, byKey.A1],
    ["e-bb1", byKey.B, byKey.B1],
    ["e-cc1", byKey.C, byKey.C1],
    ["e-dd1", byKey.D, byKey.D1],
  ];

  const edges: SpaceEdge[] = edgePairs.map(([id, aId, bId]) => ({
    id,
    aId,
    bId,
    builtin: true,
  }));

  const faces: SpaceFace[] = [
    { id: "f-bottom", vertexIds: [byKey.A, byKey.B, byKey.C, byKey.D], builtin: true },
    { id: "f-top", vertexIds: [byKey.A1, byKey.B1, byKey.C1, byKey.D1], builtin: true },
    { id: "f-front", vertexIds: [byKey.A, byKey.B, byKey.B1, byKey.A1], builtin: true },
    { id: "f-back", vertexIds: [byKey.D, byKey.C, byKey.C1, byKey.D1], builtin: true },
    { id: "f-left", vertexIds: [byKey.A, byKey.D, byKey.D1, byKey.A1], builtin: true },
    { id: "f-right", vertexIds: [byKey.B, byKey.C, byKey.C1, byKey.B1], builtin: true },
  ];

  return {
    id: nextId("pp"),
    kind: "parallelepiped",
    baseLabels,
    constraints: { ...constraints },
    vertices,
    edges,
    faces,
  };
}

export function vertexById(figure: ParallelepipedFigure, id: string): SpaceVertex | undefined {
  return figure.vertices.find((v) => v.id === id);
}

export function faceById(figure: ParallelepipedFigure, id: string): SpaceFace | undefined {
  return figure.faces.find((f) => f.id === id);
}

export function edgeById(figure: ParallelepipedFigure, id: string): SpaceEdge | undefined {
  return figure.edges.find((e) => e.id === id);
}
