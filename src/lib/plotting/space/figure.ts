import type { SpaceEdge, SpaceFace, SpaceFigure, SpaceVertex } from "./types";

export function vertexById(figure: SpaceFigure, id: string): SpaceVertex | undefined {
  return figure.vertices.find((v) => v.id === id);
}

export function faceById(figure: SpaceFigure, id: string): SpaceFace | undefined {
  return figure.faces.find((f) => f.id === id);
}

export function edgeById(figure: SpaceFigure, id: string): SpaceEdge | undefined {
  return figure.edges.find((e) => e.id === id);
}

export function faceDisplayLabel(figure: SpaceFigure, face: SpaceFace): string {
  const labels = face.vertexIds.map((id) => vertexById(figure, id)?.label ?? "?");
  return labels.join("");
}

/** Две грани имеют общее ребро (две общие вершины). */
export function facesShareEdge(figure: SpaceFigure, faceIdA: string, faceIdB: string): boolean {
  const fa = faceById(figure, faceIdA);
  const fb = faceById(figure, faceIdB);
  if (!fa || !fb) return false;
  const setA = new Set(fa.vertexIds);
  let shared = 0;
  for (const id of fb.vertexIds) {
    if (setA.has(id)) shared += 1;
  }
  return shared >= 2;
}

/** Грани, смежные с ребром. */
export function adjacentFaceIds(figure: SpaceFigure, edgeId: string): string[] {
  const edge = edgeById(figure, edgeId);
  if (!edge) return [];
  return figure.faces
    .filter((f) => f.vertexIds.includes(edge.aId) && f.vertexIds.includes(edge.bId))
    .map((f) => f.id);
}

export function isParallelepiped(figure: SpaceFigure): figure is import("./types").ParallelepipedFigure {
  return figure.kind === "parallelepiped";
}

export function isPyramid(figure: SpaceFigure): figure is import("./types").PyramidFigure {
  return figure.kind === "pyramid";
}

export function isPrism(figure: SpaceFigure): figure is import("./types").PrismFigure {
  return figure.kind === "prism";
}

/** Пирамида и призма: декартовы local, школьная проекция основания на эллипсе. */
export function isSchoolExtrusionFigure(
  figure: SpaceFigure,
): figure is import("./types").PyramidFigure | import("./types").PrismFigure {
  return figure.kind === "pyramid" || figure.kind === "prism";
}

export function figureConstraints(figure: SpaceFigure) {
  return figure.constraints;
}
