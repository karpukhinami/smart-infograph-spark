/**
 * Единая 2D-проекция для чертежа: на пирамиде точки на рёбрах тела
 * лежат на отрезке между проекциями концов (как отрисовка рёбер).
 */
import {
  genericAffineLocalToView,
  projectFromLocalCoeffs,
  type ProjectedPoint,
  type ProjectionCoeffs,
} from "./camera";
import { isPyramid } from "./figure";
import type { BuiltSpacePoint, SpaceFigure, SpaceViewParams, Vec3 } from "./types";
import { add, len, paramOnLine, scale, sub, worldToLocal } from "./vec3";

export type DisplayProjectionContext = {
  basis: { e1: Vec3; e2: Vec3; e3: Vec3 };
  projection: ProjectionCoeffs;
  points: Map<string, BuiltSpacePoint>;
  figure?: SpaceFigure;
};

const VERTEX_WORLD_EPS = 1e-5;

function isFigureVertexWorld(
  world: Vec3,
  figure: SpaceFigure,
  points: Map<string, BuiltSpacePoint>,
): boolean {
  for (const v of figure.vertices) {
    const w = points.get(v.id)?.world;
    if (w && len(sub(w, world)) <= VERTEX_WORLD_EPS) return true;
  }
  return false;
}

export function snapWorldToFigureEdge(
  world: Vec3,
  figure: SpaceFigure,
  points: Map<string, BuiltSpacePoint>,
): Vec3 {
  const on = locatePointOnFigureEdge(world, figure, points);
  if (!on) return world;
  const a = points.get(on.aId)?.world;
  const b = points.get(on.bId)?.world;
  if (!a || !b) return world;
  const t = Math.max(0, Math.min(1, on.t));
  return add(a, scale(sub(b, a), t));
}

export function locatePointOnFigureEdge(
  world: Vec3,
  figure: SpaceFigure,
  points: Map<string, BuiltSpacePoint>,
): { aId: string; bId: string; t: number } | null {
  if (isFigureVertexWorld(world, figure, points)) return null;
  let best: { aId: string; bId: string; t: number; dist: number } | null = null;
  for (const edge of figure.edges) {
    const a = points.get(edge.aId)?.world;
    const b = points.get(edge.bId)?.world;
    if (!a || !b) continue;
    const t = paramOnLine(a, b, world);
    if (t < -1e-4 || t > 1 + 1e-4) continue;
    const on = add(a, scale(sub(b, a), Math.max(0, Math.min(1, t))));
    const d = len(sub(world, on));
    const edgeLen = len(sub(b, a));
    const snapEps = Math.max(1e-4, 2e-3 * Math.max(edgeLen, 1));
    if (d > snapEps) continue;
    if (!best || d < best.dist) best = { aId: edge.aId, bId: edge.bId, t, dist: d };
  }
  return best ? { aId: best.aId, bId: best.bId, t: best.t } : null;
}

/** Проекция вершины тела без «привязки к ребру» (концы отрезка для интерполяции). */
function projectVertexRaw(
  id: string,
  ctx: DisplayProjectionContext,
  view: SpaceViewParams,
  figure: SpaceFigure,
): ProjectedPoint | null {
  const pt = ctx.points.get(id);
  if (!pt) return null;
  return projectFromLocalCoeffs(pt.local, pt.world, view, ctx.projection, figure);
}

/**
 * Проекция точки вне тела (наблюдатель, отладочные лучи) — общей гладкой
 * аффинной формулой, БЕЗ школьной модели пирамиды (полигон основания,
 * центральная проекция через вершину S). Та модель корректна только для точек
 * на/рядом с телом: для далёких точек она проецирует через «ближайшее ребро»
 * основания, из-за чего экранная позиция скачет/«залипает» на рёбрах при
 * повороте. Здесь — обычное непрерывное отображение всего пространства.
 */
export function projectWorldOffFigureBody(
  world: Vec3,
  ctx: DisplayProjectionContext,
  view: SpaceViewParams,
  figure: SpaceFigure,
): ProjectedPoint {
  const body = ctx.figure ?? figure;
  const local = isPyramid(body) ? { u: world.x, v: world.y, w: world.z } : worldToLocal(world, ctx.basis) ?? { u: 0, v: 0, w: 0 };
  const { x, y, z } = genericAffineLocalToView(local, ctx.projection);
  return { x: x * view.scale, y: -y * view.scale, depth: z, world };
}

/** Проекция world-точки для отображения (подписи, точки, сечения). */
export function projectWorldDisplay(
  world: Vec3,
  ctx: DisplayProjectionContext,
  view: SpaceViewParams,
  figure: SpaceFigure,
): ProjectedPoint {
  const body = ctx.figure ?? figure;
  if (isPyramid(body)) {
    if (isFigureVertexWorld(world, body, ctx.points)) {
      for (const v of body.vertices) {
        const pt = ctx.points.get(v.id);
        if (pt && len(sub(pt.world, world)) <= VERTEX_WORLD_EPS) {
          const pr = projectVertexRaw(v.id, ctx, view, body);
          if (pr) return pr;
        }
      }
    }
    const onEdge = locatePointOnFigureEdge(world, body, ctx.points);
    if (onEdge) {
      const prA = projectVertexRaw(onEdge.aId, ctx, view, body);
      const prB = projectVertexRaw(onEdge.bId, ctx, view, body);
      if (prA && prB) {
        const t = onEdge.t;
        const u = 1 - t;
        return {
          x: u * prA.x + t * prB.x,
          y: u * prA.y + t * prB.y,
          depth: u * prA.depth + t * prB.depth,
          world,
        };
      }
    }
  }
  const local = worldToLocal(world, ctx.basis) ?? { u: 0, v: 0, w: 0 };
  return projectFromLocalCoeffs(local, world, view, ctx.projection, body);
}
