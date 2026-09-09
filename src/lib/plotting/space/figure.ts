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

export function figureConstraints(figure: SpaceFigure) {
  return figure.constraints;
}
