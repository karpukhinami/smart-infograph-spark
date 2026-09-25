import { buildSpaceScene, type ResolvedSpaceScene } from "./build";
import { faceById, faceDisplayLabel, facesShareVertex, isPrism } from "./figure";
import {
  computeFigureFaceDepths,
  facesHaveInteriorScreenOverlap,
  isFaceVisiblePrism,
  isBodyEdgeVisiblePrism,
} from "./prism-visibility";
import { isFaceFrontFacingFigure } from "./visibility-school";
import { isBodyEdgeVisibleForRender } from "./visibility";
import type { SpaceFigure, SpaceSceneData, SpaceViewParams } from "./types";
import { projectFromLocalCoeffs } from "./camera";

export type FaceDepthOverlapBlocker = {
  otherFaceId: string;
  otherLabel: string;
  depthSelfAtOverlap: number;
  depthOtherAtOverlap: number;
};

export type SpaceFaceDepthRow = {
  faceId: string;
  label: string;
  depthCentroid: number;
  frontFacing: boolean;
  /** Только для призмы — итог видимости грани для рёбер. */
  faceVisible: boolean | null;
  solidEdges: number;
  dashedEdges: number;
  interiorOverlapWith: string[];
  blockers: FaceDepthOverlapBlocker[];
};

export type SpaceFaceDepthReport = {
  capturedAt: string;
  yaw: number;
  depthMode: string;
  figureKind: string;
  rows: SpaceFaceDepthRow[];
};

type ScreenPoly = Array<{ x: number; y: number; depth: number }>;

function buildFaceScreenPolys(
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): Map<string, ScreenPoly> {
  const out = new Map<string, ScreenPoly>();
  for (const face of figure.faces) {
    const poly = face.vertexIds
      .map((id) => {
        const pt = resolved.points.get(id);
        if (!pt) return null;
        const pr = projectFromLocalCoeffs(pt.local, pt.world, view, resolved.projection, figure);
        return { x: pr.x, y: pr.y, depth: pr.depth };
      })
      .filter(Boolean) as ScreenPoly;
    if (poly.length >= 3) out.set(face.id, poly);
  }
  return out;
}

function collectBlockers(
  figure: SpaceFigure,
  faceId: string,
  faceScreen: Map<string, ScreenPoly>,
  resolved: ResolvedSpaceScene,
): { blockers: FaceDepthOverlapBlocker[]; overlapLabels: string[] } {
  const blockers: FaceDepthOverlapBlocker[] = [];
  const overlapLabels: string[] = [];
  const polyF = faceScreen.get(faceId);
  if (!polyF) return { blockers, overlapLabels };

  for (const other of figure.faces) {
    if (other.id === faceId) continue;
    if (facesShareVertex(figure, faceId, other.id)) continue;
    if (!isFaceFrontFacingFigure(other.id, figure, resolved)) continue;
    const polyG = faceScreen.get(other.id);
    if (!polyG) continue;
    if (!facesHaveInteriorScreenOverlap(polyF, polyG)) continue;
    overlapLabels.push(faceDisplayLabel(figure, other));
    const sample = findOverlapSample(polyF, polyG);
    if (!sample) continue;
    const dF = depthAt(sample, polyF);
    const dG = depthAt(sample, polyG);
    if (dF === null || dG === null) continue;
    if (dG < dF - 1e-5) {
      blockers.push({
        otherFaceId: other.id,
        otherLabel: faceDisplayLabel(figure, other),
        depthSelfAtOverlap: dF,
        depthOtherAtOverlap: dG,
      });
    }
  }
  return { blockers, overlapLabels };
}

function findOverlapSample(a: ScreenPoly, b: ScreenPoly): { x: number; y: number } | null {
  for (let i = 0; i < a.length; i += 1) {
    const p = { x: (a[i]!.x + a[(i + 1) % a.length]!.x) / 2, y: (a[i]!.y + a[(i + 1) % a.length]!.y) / 2 };
    if (pointInPoly(p.x, p.y, a) && pointInPoly(p.x, p.y, b)) return p;
  }
  return null;
}

function pointInPoly(px: number, py: number, poly: ScreenPoly): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return sign !== 0;
}

function depthAt(p: { x: number; y: number }, poly: ScreenPoly): number | null {
  if (poly.length === 3) {
    const [v0, v1, v2] = poly;
    const den =
      (v1!.y - v2!.y) * (v0!.x - v2!.x) + (v2!.x - v1!.x) * (v0!.y - v2!.y);
    if (Math.abs(den) < 1e-12) return (v0!.depth + v1!.depth + v2!.depth) / 3;
    const w0 =
      ((v1!.y - v2!.y) * (p.x - v2!.x) + (v2!.x - v1!.x) * (p.y - v2!.y)) / den;
    const w1 =
      ((v2!.y - v0!.y) * (p.x - v2!.x) + (v0!.x - v2!.x) * (p.y - v2!.y)) / den;
    const w2 = 1 - w0 - w1;
    return w0 * v0!.depth + w1 * v1!.depth + w2 * v2!.depth;
  }
  return poly.reduce((s, v) => s + v.depth, 0) / poly.length;
}

function edgeVisibilityOnFace(
  figure: SpaceFigure,
  faceId: string,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): { solid: number; dashed: number } {
  const face = faceById(figure, faceId);
  if (!face) return { solid: 0, dashed: 0 };
  let solid = 0;
  let dashed = 0;
  for (const edge of figure.edges) {
    if (!face.vertexIds.includes(edge.aId) || !face.vertexIds.includes(edge.bId)) continue;
    const vis = isPrism(figure)
      ? isBodyEdgeVisiblePrism(edge.id, figure, resolved, view)
      : isBodyEdgeVisibleForRender(edge.id, figure, resolved, view);
    if (vis) solid += 1;
    else dashed += 1;
  }
  return { solid, dashed };
}

/** Снимок глубин и видимости граней на момент вызова (для отладки пунктира). */
export function buildSpaceFaceDepthReport(data: SpaceSceneData): SpaceFaceDepthReport | null {
  const figure = data.figure;
  if (!figure) return null;

  const resolved = buildSpaceScene(data);
  const view = data.view;
  const depths = computeFigureFaceDepths(figure, resolved, view);

  const faceScreen = buildFaceScreenPolys(figure, resolved, view);

  const rows: SpaceFaceDepthRow[] = figure.faces.map((face) => {
    const { blockers, overlapLabels } = isPrism(figure)
      ? collectBlockers(figure, face.id, faceScreen, resolved)
      : { blockers: [], overlapLabels: [] };
    const { solid, dashed } = edgeVisibilityOnFace(figure, face.id, resolved, view);
    return {
      faceId: face.id,
      label: faceDisplayLabel(figure, face),
      depthCentroid: depths.get(face.id) ?? Number.NaN,
      frontFacing: isFaceFrontFacingFigure(face.id, figure, resolved),
      faceVisible: isPrism(figure) ? isFaceVisiblePrism(face.id, figure, resolved, view) : null,
      solidEdges: solid,
      dashedEdges: dashed,
      interiorOverlapWith: overlapLabels,
      blockers,
    };
  });

  rows.sort((a, b) => a.depthCentroid - b.depthCentroid);

  return {
    capturedAt: new Date().toISOString(),
    yaw: view.yaw,
    depthMode: view.planeFillDepthMode ?? "eye",
    figureKind: figure.kind,
    rows,
  };
}
