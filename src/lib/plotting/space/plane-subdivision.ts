import {
  computeFaceOrPlaneSection,
  planeIntersectionSegmentRange,
  type ResolvedSpaceScene,
} from "./build";
import { worldViewSortDepth } from "./camera";
import type { PlaneFillDepthMode, SpaceFigure, SpaceSceneData, Vec3 } from "./types";
import { add, dot, intersectPlanes, len, planePointDistance, scale, sub, type PlaneEq } from "./vec3";

export type ScreenProjectFn = (world: Vec3) => { x: number; y: number };

export interface PlaneFillFragment {
  planeId: string;
  color: string;
  vertices: Vec3[];
  /** Глубина в барицентре фрагмента: меньше — ближе к наблюдателю. */
  depth: number;
  /**
   * Исходное (неразбитое) сечение плоскости — по нему определяется, какие
   * рёбра фрагмента являются настоящей границей плоскости, а какие —
   * технические «разрезы», появившиеся при делении на фрагменты для
   * подсчёта глубины (их не нужно рисовать как линии).
   */
  originalSection: Vec3[];
}

/**
 * Делит выпуклое сечение плоскости A на части по полупространствам плоскости B.
 * Граница — линия пересечения A∩B (без 2D-проекции и без clipLineToConvexPolygon).
 */
function splitConvexPolygonByHalfSpace(
  polygon: Vec3[],
  cuttingPlane: PlaneEq,
  eps = 1e-7,
): Vec3[][] {
  const dists = polygon.map((p) => planePointDistance(p, cuttingPlane));
  const hasPos = dists.some((d) => d > eps);
  const hasNeg = dists.some((d) => d < -eps);
  if (!hasPos || !hasNeg) return [polygon];

  const pos: Vec3[] = [];
  const neg: Vec3[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i += 1) {
    const cur = polygon[i]!;
    const next = polygon[(i + 1) % n]!;
    const dc = dists[i]!;
    const dn = dists[(i + 1) % n]!;

    if (dc >= -eps) pos.push(cur);
    if (dc <= eps) neg.push(cur);

    if (dc * dn < -eps * eps) {
      const t = dc / (dc - dn);
      const hit = add(cur, scale(sub(next, cur), t));
      pos.push(hit);
      neg.push(hit);
    }
  }

  const out: Vec3[][] = [];
  if (pos.length >= 3) out.push(pos);
  if (neg.length >= 3) out.push(neg);
  return out.length ? out : [polygon];
}

/**
 * Проверяет, лежит ли отрезок [a,b] на одном из рёбер исходного многоугольника
 * `section` (в пределах его длины). Используется, чтобы отличить настоящие
 * границы сечения плоскости от «разрезов», добавленных при делении фрагмента
 * линией пересечения с другой плоскостью — такие разрезы не являются частью
 * контура плоскости и не должны отображаться как линия.
 */
export function isSegmentOnPolygonBoundary(
  a: Vec3,
  b: Vec3,
  section: Vec3[],
  eps = 1e-4,
): boolean {
  const n = section.length;
  for (let i = 0; i < n; i += 1) {
    const p0 = section[i]!;
    const p1 = section[(i + 1) % n]!;
    const full = sub(p1, p0);
    const edgeLen = len(full);
    if (edgeLen < 1e-9) continue;
    const dir = scale(full, 1 / edgeLen);

    const da = sub(a, p0);
    const db = sub(b, p0);
    const ta = dot(da, dir);
    const tb = dot(db, dir);
    const perpA = sub(da, scale(dir, ta));
    const perpB = sub(db, scale(dir, tb));
    if (len(perpA) > eps || len(perpB) > eps) continue;

    const lo = Math.min(ta, tb);
    const hi = Math.max(ta, tb);
    if (lo >= -eps && hi <= edgeLen + eps) return true;
  }
  return false;
}

/** Делит сечение плоскости на части линиями пересечения с другими плоскостями. */
export function subdividePlaneSection(
  section: Vec3[],
  planeEq: PlaneEq,
  otherPlaneEqs: PlaneEq[],
): Vec3[][] {
  let fragments: Vec3[][] = [section];
  for (const otherEq of otherPlaneEqs) {
    const next: Vec3[][] = [];
    for (const frag of fragments) {
      if (frag.length < 3) continue;
      next.push(...splitConvexPolygonByHalfSpace(frag, otherEq));
    }
    fragments = next.length ? next : fragments;
  }
  return fragments;
}

function polygonBarycenter(vertices: Vec3[]): Vec3 {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const v of vertices) {
    sx += v.x;
    sy += v.y;
    sz += v.z;
  }
  const n = Math.max(vertices.length, 1);
  return { x: sx / n, y: sy / n, z: sz / n };
}

/** Глубина фрагмента — в барицентре многоугольника (режим задаётся в `planeFillDepthMode`). */
function fragmentSortDepth(
  vertices: Vec3[],
  resolved: ResolvedSpaceScene,
  figure: SpaceFigure,
  mode: PlaneFillDepthMode,
): number {
  const c = polygonBarycenter(vertices);
  return worldViewSortDepth(c, resolved.basis, resolved.projection, figure, mode);
}

function sideOfScreenLine(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/**
 * Сверка по **проекции**: слева/справа от линии пересечения на экране.
 * Меньший depth = ближе = рисуется сверху. С одной стороны линии «победитель»
 * не должен совпадать с другой стороной; если одна плоскость выигрывает обе —
 * сдвигаем depth на одной стороне так, чтобы порядок перевернулся.
 */
function reconcileTwoPlaneFragmentsByScreenSide(
  fragments: PlaneFillFragment[],
  planeAId: string,
  planeBId: string,
  eqA: PlaneEq,
  eqB: PlaneEq,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  project: ScreenProjectFn,
): void {
  const carrier = intersectPlanes(eqA, eqB);
  if (!carrier) return;
  const clip = planeIntersectionSegmentRange(
    carrier,
    planeAId,
    planeBId,
    figure,
    resolved.points,
    resolved.planes,
    resolved.basis,
  );
  if (!clip || clip.t1 - clip.t0 < 1e-9) return;

  const w0 = add(carrier.origin, scale(carrier.dir, clip.t0));
  const w1 = add(carrier.origin, scale(carrier.dir, clip.t1));
  const s0 = project(w0);
  const s1 = project(w1);
  const lineLen = Math.hypot(s1.x - s0.x, s1.y - s0.y);
  if (!(lineLen > 1e-6)) return;

  const pairFrags = fragments.filter(
    (f) => f.planeId === planeAId || f.planeId === planeBId,
  );

  const classifySide = (frag: PlaneFillFragment): "left" | "right" | "on" => {
    const c = polygonBarycenter(frag.vertices);
    const cross = sideOfScreenLine(project(c), s0, s1);
    const tol = 1e-4 * lineLen;
    if (Math.abs(cross) <= tol) return "on";
    return cross > 0 ? "left" : "right";
  };

  const bySide = (side: "left" | "right") =>
    pairFrags.filter((f) => classifySide(f) === side);

  const winnerOnSide = (sideFrags: PlaneFillFragment[]): string | null => {
    const aOn = sideFrags.filter((f) => f.planeId === planeAId);
    const bOn = sideFrags.filter((f) => f.planeId === planeBId);
    if (!aOn.length || !bOn.length) return null;
    const minA = Math.min(...aOn.map((f) => f.depth));
    const minB = Math.min(...bOn.map((f) => f.depth));
    return minA < minB ? planeAId : planeBId;
  };

  const leftFrags = bySide("left");
  const rightFrags = bySide("right");
  const winLeft = winnerOnSide(leftFrags);
  const winRight = winnerOnSide(rightFrags);
  if (!winLeft || !winRight || winLeft !== winRight) return;

  const depths = pairFrags.map((f) => f.depth);
  const span = Math.max(...depths) - Math.min(...depths);
  const bump = Math.max(0.08, span * 0.6 + 0.02);
  const loser = winLeft === planeAId ? planeBId : planeAId;

  const fixSide = (sideFrags: PlaneFillFragment[]) => {
    for (const f of sideFrags) {
      if (f.planeId === winLeft) f.depth += bump;
      if (f.planeId === loser) f.depth -= bump;
    }
  };

  /** Переворачиваем порядок на стороне, где больше площадь перекрытия (обычно «право»). */
  if (rightFrags.some((f) => f.planeId === planeAId) && rightFrags.some((f) => f.planeId === planeBId)) {
    fixSide(rightFrags);
  } else if (
    leftFrags.some((f) => f.planeId === planeAId) &&
    leftFrags.some((f) => f.planeId === planeBId)
  ) {
    fixSide(leftFrags);
  }
}

/**
 * Фрагменты заливки всех плоскостей, отсортированные от дальних к ближним
 * (ближние рисуются последними).
 */
export function collectPlaneFillFragments(
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  screenProject?: ScreenProjectFn,
): PlaneFillFragment[] {
  const builtPlanes = data.planes.filter((p) => p.built && p.style.visible);
  const depthMode: PlaneFillDepthMode = data.view.planeFillDepthMode ?? "plane";
  const fragments: PlaneFillFragment[] = [];

  for (const plane of builtPlanes) {
    const eq = resolved.planes.get(plane.id);
    if (!eq) continue;
    const section = computeFaceOrPlaneSection(
      plane.id,
      figure,
      resolved.points,
      resolved.planes,
      resolved.basis,
    );
    if (!section || section.length < 3) continue;

    const otherEqs = builtPlanes
      .filter((p) => p.id !== plane.id)
      .map((p) => resolved.planes.get(p.id))
      .filter(Boolean) as PlaneEq[];

    const parts =
      otherEqs.length > 0 ? subdividePlaneSection(section, eq, otherEqs) : [section];

    for (const part of parts) {
      if (part.length < 3) continue;
      fragments.push({
        planeId: plane.id,
        color: plane.style.color,
        vertices: part,
        depth: fragmentSortDepth(part, resolved, figure, depthMode),
        originalSection: section,
      });
    }
  }

  if (screenProject) {
    for (let i = 0; i < builtPlanes.length; i += 1) {
      for (let j = i + 1; j < builtPlanes.length; j += 1) {
        const pa = builtPlanes[i]!;
        const pb = builtPlanes[j]!;
        const eqA = resolved.planes.get(pa.id);
        const eqB = resolved.planes.get(pb.id);
        if (!eqA || !eqB) continue;
        reconcileTwoPlaneFragmentsByScreenSide(
          fragments,
          pa.id,
          pb.id,
          eqA,
          eqB,
          figure,
          resolved,
          screenProject,
        );
      }
    }
  }

  fragments.sort((a, b) => b.depth - a.depth);
  return fragments;
}
