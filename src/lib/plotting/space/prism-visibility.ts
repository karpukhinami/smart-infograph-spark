/**
 * Видимость рёбер призмы: сравнение глубины граней основания и боковых граней.
 * Не использует выпуклую оболочку / «внутреннюю вершину» пирамиды.
 */
import type { ResolvedSpaceScene } from "./build";
import { worldViewSortDepth } from "./camera";
import { adjacentFaceIds, edgeById } from "./figure";
import type { PrismFigure, SpaceViewParams, Vec3 } from "./types";
import { add, scale } from "./vec3";

const DEPTH_EPS = 1e-5;

function faceCentroidWorld(
  vertexIds: string[],
  resolved: ResolvedSpaceScene,
): Vec3 | null {
  const pts: Vec3[] = [];
  for (const id of vertexIds) {
    const w = resolved.points.get(id)?.world;
    if (w) pts.push(w);
  }
  if (!pts.length) return null;
  return scale(
    pts.reduce((acc, p) => add(acc, p), { x: 0, y: 0, z: 0 }),
    1 / pts.length,
  );
}

/** Школьная глубина в центре грани (меньше — ближе к наблюдателю). */
export function computePrismFaceDepths(
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
): Map<string, number> {
  const mode = view.planeFillDepthMode ?? "eye";
  const depths = new Map<string, number>();
  for (const face of figure.faces) {
    const center = faceCentroidWorld(face.vertexIds, resolved);
    if (!center) {
      depths.set(face.id, Number.POSITIVE_INFINITY);
      continue;
    }
    depths.set(
      face.id,
      worldViewSortDepth(center, resolved.basis, resolved.projection, figure, mode),
    );
  }
  return depths;
}

function minFaceDepth(depths: Map<string, number>): number {
  let min = Number.POSITIVE_INFINITY;
  for (const d of depths.values()) min = Math.min(min, d);
  return min;
}

/**
 * Сплошное, если хотя бы одна смежная грань — на переднем слое (минимальная
 * глубина среди оснований и боковых граней). Обе сзади → пунктир.
 * Если одна грань ближе, другая дальше — сплошная.
 */
export function isBodyEdgeVisiblePrism(
  edgeId: string,
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  faceDepths?: Map<string, number>,
): boolean {
  const edge = edgeById(figure, edgeId);
  if (!edge) return true;

  const depths = faceDepths ?? computePrismFaceDepths(figure, resolved, view);
  const dFront = minFaceDepth(depths);
  const adjacent = adjacentFaceIds(figure, edgeId);

  if (adjacent.length === 0) return true;
  if (adjacent.length === 1) {
    const d = depths.get(adjacent[0]!) ?? Number.POSITIVE_INFINITY;
    return d <= dFront + DEPTH_EPS;
  }

  const d0 = depths.get(adjacent[0]!) ?? Number.POSITIVE_INFINITY;
  const d1 = depths.get(adjacent[1]!) ?? Number.POSITIVE_INFINITY;
  return d0 <= dFront + DEPTH_EPS || d1 <= dFront + DEPTH_EPS;
}

export function isFaceVisiblePrism(
  faceId: string,
  figure: PrismFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceViewParams,
  faceDepths?: Map<string, number>,
): boolean {
  const depths = faceDepths ?? computePrismFaceDepths(figure, resolved, view);
  const dFront = minFaceDepth(depths);
  const d = depths.get(faceId) ?? Number.POSITIVE_INFINITY;
  return d <= dFront + DEPTH_EPS;
}
