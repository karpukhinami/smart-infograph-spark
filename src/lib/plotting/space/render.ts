import { layoutLabels, measureTextWidth, type LabelRequest, type Obstacle, type Rect } from "../label-layout";
import {
  buildSpaceScene,
  computeFaceOrPlaneSection,
  computeLineDisplayRange,
  computePlaneHelperSegments,
  getPlaneOutsideSupportPoints,
  planeIntersectionSegmentRange,
  resolveLineCarrier,
  type ResolvedSpaceScene,
} from "./build";
import { fitSpaceProjection, projectFromLocalCoeffs, sampleRotationEllipse } from "./camera";
import {
  projectWorldDisplay,
  projectWorldOffFigureBody,
  type DisplayProjectionContext,
} from "./display-projection";
import { collectVisibleOverlaySegments, isEdgeCoveredOnScreen } from "./edge-overlay";
import { collectPlaneFillFragments } from "./plane-subdivision";
import {
  buildOcclusionContext,
  isBodyEdgeVisibleForRender,
  splitLineByVisibility,
  splitLineForRender,
  type OcclusionContext,
} from "./visibility";
import { isPyramid } from "./figure";
import { buildSchoolViewObserver, figureBodyCenterWorld } from "./pyramid-view";
import type { SpaceFigure, SpaceLine, SpacePlane, SpaceSceneData, Vec3 } from "./types";
import { add, dot, intersectPlanes, len, scale, sub, worldToLocal } from "./vec3";

function round(n: number): string {
  return String(Number(n.toFixed(2)));
}

/** Треугольный наконечник в конце вектора (как стрелка оси на координатной плоскости). */
function vectorArrowheadPolygon(
  tipX: number,
  tipY: number,
  dirX: number,
  dirY: number,
  arrowSize: number,
): string {
  const l = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / l;
  const uy = dirY / l;
  const half = arrowSize * 0.225;
  const bx = tipX - ux * arrowSize;
  const by = tipY - uy * arrowSize;
  const x1 = bx - uy * half;
  const y1 = by + ux * half;
  const x2 = bx + uy * half;
  const y2 = by - ux * half;
  return `${round(tipX)},${round(tipY)} ${round(x1)},${round(y1)} ${round(x2)},${round(y2)}`;
}

function escapeText(v: string): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function lineObstacle(x1: number, y1: number, x2: number, y2: number, kind: Obstacle["kind"]): Obstacle {
  return { kind, points: [[x1, y1], [x2, y2]] };
}

/** Если отрезок целиком лежит на ребре тела, возвращает видимость этого ребра. */
function inheritedBodyEdgeVisibility(
  aWorld: Vec3,
  bWorld: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
): boolean | null {
  let sizeRef = 1;
  for (const vertex of figure.vertices) {
    const world = resolved.points.get(vertex.id)?.world;
    if (world) sizeRef = Math.max(sizeRef, len(world));
  }
  const eps = sizeRef * 1e-5;
  for (const edge of figure.edges) {
    const edgeA = resolved.points.get(edge.aId)?.world;
    const edgeB = resolved.points.get(edge.bId)?.world;
    if (!edgeA || !edgeB) continue;
    if (pointSegDist(aWorld, edgeA, edgeB) > eps || pointSegDist(bWorld, edgeA, edgeB) > eps) continue;
    return isBodyEdgeVisibleForRender(edge.id, figure, resolved, view);
  }
  return null;
}

/** Экранное совпадение тоже наследует штрих: иначе наложенная цветная линия визуально инвертирует ребро. */
function inheritedProjectedBodyEdgeVisibility(
  aWorld: Vec3,
  bWorld: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
  fit: { scale: number; cx: number; cy: number },
): boolean | null {
  const a = projectWorld(aWorld, resolved, view, fit, figure);
  const b = projectWorld(bWorld, resolved, view, fit, figure);
  const distance = (
    p: { x: number; y: number },
    s0: { x: number; y: number },
    s1: { x: number; y: number },
  ) => {
    const dx = s1.x - s0.x;
    const dy = s1.y - s0.y;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-12) return Math.hypot(p.x - s0.x, p.y - s0.y);
    const t = Math.max(0, Math.min(1, ((p.x - s0.x) * dx + (p.y - s0.y) * dy) / l2));
    return Math.hypot(p.x - (s0.x + t * dx), p.y - (s0.y + t * dy));
  };
  for (const edge of figure.edges) {
    const edgeA = resolved.points.get(edge.aId)?.world;
    const edgeB = resolved.points.get(edge.bId)?.world;
    if (!edgeA || !edgeB) continue;
    const p0 = projectWorld(edgeA, resolved, view, fit, figure);
    const p1 = projectWorld(edgeB, resolved, view, fit, figure);
    if (distance(a, p0, p1) > 0.5 || distance(b, p0, p1) > 0.5) continue;
    return isBodyEdgeVisibleForRender(edge.id, figure, resolved, view);
  }
  return null;
}

/** Рисует отрезок с учётом грани (видимая/скрытая) или окклюзии тела. */
function drawSegmentWithVisibility(
  aWorld: Vec3,
  bWorld: Vec3,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
  fit: { scale: number; cx: number; cy: number },
  occlusion: OcclusionContext,
  color: string,
  width: number,
  hiddenDash: string,
  parts: string[],
  obstacles: Obstacle[],
  strokeOpacity?: number,
  /** В режиме заливки по глубине скрытые куски не рисуем — пунктир только на линии пересечения. */
  skipHiddenSegments = false,
  /** Для границ сечения пирамиды нужна проверка по глубине поверхности, а не по оболочке вершин. */
  useSurfaceDepth = false,
  /** Совпадающая с ребром тела граница обязана повторять его штрих. */
  inheritBodyEdgeStroke = false,
): void {
  const dir = sub(bWorld, aWorld);
  const abLen = len(dir);
  if (!(abLen > 1e-9)) return;
  const unit = scale(dir, 1 / abLen);
  const bodyEdgeVisibility = inheritBodyEdgeStroke
    ? inheritedBodyEdgeVisibility(aWorld, bWorld, figure, resolved, view) ??
      inheritedProjectedBodyEdgeVisibility(aWorld, bWorld, figure, resolved, view, fit)
    : null;
  const segments =
    bodyEdgeVisibility !== null
      ? [{ a: aWorld, b: bWorld, visible: bodyEdgeVisibility }]
      : useSurfaceDepth
        ? splitLineByVisibility(aWorld, unit, 0, abLen, figure, resolved, view, occlusion)
        : splitLineForRender(aWorld, unit, 0, abLen, figure, resolved, view, occlusion);
  const opacityAttr =
    strokeOpacity !== undefined && strokeOpacity < 1
      ? ` stroke-opacity="${strokeOpacity}"`
      : "";
  for (const seg of segments) {
    if (skipHiddenSegments && !seg.visible) continue;
    const p1 = projectWorld(seg.a, resolved, view, fit, figure);
    const p2 = projectWorld(seg.b, resolved, view, fit, figure);
    const dash = seg.visible ? "" : ` stroke-dasharray="${hiddenDash}"`;
    parts.push(
      `<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${dash}${opacityAttr}/>`,
    );
    obstacles.push(lineObstacle(p1.x, p1.y, p2.x, p2.y, seg.visible ? "curve" : "helper"));
  }
}

const PYRAMID_CARRIER_MIN_STEPS = 6;
const PYRAMID_CARRIER_MAX_STEPS = 28;

/** Параметрическая прямая P(t)=origin+t·dir: на пирамиде проекция криволинейна, рисуем цепочкой коротких отрезков. */
function drawCarrierWithVisibility(
  origin: Vec3,
  dir: Vec3,
  t0: number,
  t1: number,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
  fit: { scale: number; cx: number; cy: number },
  occlusion: OcclusionContext,
  color: string,
  width: number,
  hiddenDash: string,
  parts: string[],
  obstacles: Obstacle[],
): void {
  const span = t1 - t0;
  if (!(span > 1e-12)) return;

  if (isPyramid(figure)) {
    const steps = Math.min(
      PYRAMID_CARRIER_MAX_STEPS,
      Math.max(PYRAMID_CARRIER_MIN_STEPS, Math.ceil(span * 10)),
    );
    for (let i = 0; i < steps; i += 1) {
      const ta = t0 + (span * i) / steps;
      const tb = t0 + (span * (i + 1)) / steps;
      drawSegmentWithVisibility(
        add(origin, scale(dir, ta)),
        add(origin, scale(dir, tb)),
        figure,
        resolved,
        view,
        fit,
        occlusion,
        color,
        width,
        hiddenDash,
        parts,
        obstacles,
      );
    }
    return;
  }

  drawSegmentWithVisibility(
    add(origin, scale(dir, t0)),
    add(origin, scale(dir, t1)),
    figure,
    resolved,
    view,
    fit,
    occlusion,
    color,
    width,
    hiddenDash,
    parts,
    obstacles,
  );
}

function displayCtxFromResolved(resolved: ResolvedSpaceScene): DisplayProjectionContext {
  return {
    basis: resolved.basis,
    projection: resolved.projection,
    points: resolved.points,
    figure: resolved.figure,
  };
}

function projectWorld(
  world: Vec3,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
  fit: { scale: number; cx: number; cy: number },
  figure: SpaceFigure,
): { x: number; y: number } {
  const pr = projectWorldDisplay(world, displayCtxFromResolved(resolved), view, figure);
  return { x: pr.x * fit.scale + fit.cx, y: pr.y * fit.scale + fit.cy };
}

function projectWorldWithDepth(
  world: Vec3,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
  fit: { scale: number; cx: number; cy: number },
  figure: SpaceFigure,
): { x: number; y: number; depth: number } {
  const projected = projectWorldDisplay(world, displayCtxFromResolved(resolved), view, figure);
  return {
    x: projected.x * fit.scale + fit.cx,
    y: projected.y * fit.scale + fit.cy,
    depth: projected.depth,
  };
}

function renderLabels(
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  obstacles: Obstacle[],
  fit: { scale: number; cx: number; cy: number },
  a: SpaceSceneData["appearance"],
): string {
  const area: Rect = { x: a.padding, y: a.padding, width: a.width - a.padding * 2, height: a.height - a.padding * 2 };
  const requests: LabelRequest[] = [];

  for (const vertex of figure.vertices) {
    const pr = resolved.projected.get(vertex.id);
    if (!pr) continue;
    requests.push({
      id: vertex.id,
      anchorX: pr.x * fit.scale + fit.cx,
      anchorY: pr.y * fit.scale + fit.cy,
      width: measureTextWidth(vertex.label, a.labelFontSize),
      height: a.labelFontSize * 1.12,
      gap: a.pointRadius + 16,
    });
  }

  for (const point of data.points) {
    if (!point.style.visible || !point.built) continue;
    const pr = resolved.projected.get(point.id);
    if (!pr || !point.label.trim()) continue;
    requests.push({
      id: point.id,
      anchorX: pr.x * fit.scale + fit.cx,
      anchorY: pr.y * fit.scale + fit.cy,
      width: measureTextWidth(point.label, a.labelFontSize),
      height: a.labelFontSize * 1.12,
      gap: a.pointRadius + 16,
      placement: point.style.labelPlacement,
    });
  }

  return layoutLabels(requests, obstacles, area, { fontSize: a.labelFontSize, allowBackdrop: false })
    .map((item) => {
      const color =
        figure.vertices.some((v) => v.id === item.id)
          ? a.labelColor
          : data.points.find((p) => p.id === item.id)?.style.color ?? a.labelColor;
      const text =
        figure.vertices.find((v) => v.id === item.id)?.label ??
        data.points.find((p) => p.id === item.id)?.label ??
        "";
      return `<text x="${round(item.x)}" y="${round(item.y)}" text-anchor="${item.textAnchor}" font-family="${escapeText(a.labelFontFamily)}" font-size="${a.labelFontSize}" fill="${color}" font-style="italic">${escapeText(text)}</text>`;
    })
    .join("");
}

function renderLineObject(
  line: SpaceLine,
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  fit: { scale: number; cx: number; cy: number },
  occlusion: OcclusionContext,
  parts: string[],
  obstacles: Obstacle[],
): void {
  if (!line.style.visible || !line.built) return;
  const carrier = resolveLineCarrier(line, figure, resolved.points, resolved.planes, data.lines);
  if (!carrier) return;
  const def = line.definition;
  let origin = carrier.origin;
  let dir = carrier.dir;
  let t0 = -1;
  let t1 = 1;

  if (def.kind === "twoPoints") {
    const a = resolved.points.get(def.aId)?.world;
    const b = resolved.points.get(def.bId)?.world;
    if (!a || !b) return;
    const ab = sub(b, a);
    const abLen = len(ab);
    if (!(abLen > 1e-9)) return;
    origin = a;
    dir = scale(ab, 1 / abLen);
    if (line.style.visualKind === "segment") {
      t0 = 0;
      t1 = abLen;
    } else if (line.style.visualKind === "vector") {
      t0 = 0;
      const pA = projectWorld(a, resolved, data.view, fit, figure);
      const pB = projectWorld(b, resolved, data.view, fit, figure);
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const screenLen = Math.hypot(dx, dy);
      const arrow = data.appearance.arrowSize;
      const trimRatio =
        screenLen > arrow + 2 ? Math.max(0.05, (screenLen - arrow) / screenLen) : 0.88;
      t1 = abLen * trimRatio;
    } else {
      const range = computeLineDisplayRange(
        { origin, dir },
        resolved.points,
        0,
        abLen,
        data.appearance.lineExtension * abLen,
        figure,
      );
      t0 = range.t0;
      t1 = range.t1;
    }
  } else {
    const clip = planeIntersectionSegmentRange(
      carrier,
      def.planeAId,
      def.planeBId,
      figure,
      resolved.points,
      resolved.planes,
      resolved.basis,
    );
    if (!clip) return;
    t0 = clip.t0;
    t1 = clip.t1;
    if (line.style.visualKind === "line") {
      const span = Math.max(t1 - t0, 1e-6);
      const ext = data.appearance.lineExtension * span;
      t0 -= ext;
      t1 += ext;
    }
  }

  const sw = line.style.width ?? data.appearance.lineWidth;
  drawCarrierWithVisibility(
    origin,
    dir,
    t0,
    t1,
    figure,
    resolved,
    data.view,
    fit,
    occlusion,
    line.style.color,
    sw,
    data.appearance.hiddenDash,
    parts,
    obstacles,
  );

  if (line.style.visualKind === "vector" && def.kind === "twoPoints") {
    const a = resolved.points.get(def.aId)?.world;
    const b = resolved.points.get(def.bId)?.world;
    if (a && b) {
      const pTip = projectWorld(b, resolved, data.view, fit, figure);
      const pTail = projectWorld(a, resolved, data.view, fit, figure);
      const poly = vectorArrowheadPolygon(
        pTip.x,
        pTip.y,
        pTip.x - pTail.x,
        pTip.y - pTail.y,
        data.appearance.arrowSize,
      );
      parts.push(`<polygon points="${poly}" fill="${line.style.color}"/>`);
    }
  }
}

function renderPlaneFillPolygon(
  vertices: Vec3[],
  color: string,
  fillOpacity: number,
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  fit: { scale: number; cx: number; cy: number },
  parts: string[],
): void {
  if (vertices.length < 3) return;
  // Фрагмент уже является итоговым многоугольником после всех попарных
  // пересечений. Нельзя повторно триангулировать его для пирамиды: её
  // школьная проекция нелинейна вне рёбер тела, поэтому независимо
  // спроецированные внутренние точки треугольников могут выйти за экранный
  // контур фрагмента и дать ложные клинья. Заливаем ровно контур его вершин.
  const screenPts = vertices.map((w) => projectWorld(w, resolved, data.view, fit, figure));
  const poly = screenPts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
  parts.push(
    `<polygon points="${poly}" fill="${color}" fill-opacity="${fillOpacity}" stroke="none"/>`,
  );
}

function renderPlaneSectionEdges(
  section: Vec3[],
  plane: SpacePlane,
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  fit: { scale: number; cx: number; cy: number },
  occlusion: OcclusionContext,
  parts: string[],
  obstacles: Obstacle[],
  fillByDepth = false,
): void {
  const edgeWidth = data.appearance.lineWidth;
  for (let i = 0; i < section.length; i += 1) {
    const a = section[i]!;
    const b = section[(i + 1) % section.length]!;
    drawSegmentWithVisibility(
      a,
      b,
      figure,
      resolved,
      data.view,
      fit,
      occlusion,
      plane.style.color,
      edgeWidth,
      data.appearance.hiddenDash,
      parts,
      obstacles,
      undefined,
      fillByDepth,
      isPyramid(figure),
      true,
    );
  }
}

function renderPlaneHelperLines(
  plane: SpacePlane,
  section: Vec3[],
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  fit: { scale: number; cx: number; cy: number },
  occlusion: OcclusionContext,
  parts: string[],
  obstacles: Obstacle[],
): void {
  const planeEq = resolved.planes.get(plane.id);
  if (!planeEq) return;
  const edgeWidth = data.appearance.lineWidth;
  const helperWidth = edgeWidth / 2;
  const supports = getPlaneOutsideSupportPoints(plane, resolved.points, resolved.basis, figure);
  for (const support of supports) {
    const helpers = computePlaneHelperSegments(
      section,
      support,
      planeEq,
      resolved.basis,
      figure,
      resolved.points,
    );
    for (const seg of helpers) {
      drawSegmentWithVisibility(
        seg.from,
        seg.to,
        figure,
        resolved,
        data.view,
        fit,
        occlusion,
        plane.style.color,
        helperWidth,
        data.appearance.hiddenDash,
        parts,
        obstacles,
      );
    }
  }
}

function renderPlaneOutlines(
  plane: SpacePlane,
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  fit: { scale: number; cx: number; cy: number },
  occlusion: OcclusionContext,
  parts: string[],
  obstacles: Obstacle[],
): void {
  if (!plane.style.visible || !plane.built) return;
  const section = computeFaceOrPlaneSection(
    plane.id,
    figure,
    resolved.points,
    resolved.planes,
    resolved.basis,
  );
  if (!section || section.length < 3) return;

  renderPlaneSectionEdges(section, plane, data, figure, resolved, fit, occlusion, parts, obstacles);
  renderPlaneHelperLines(plane, section, data, figure, resolved, fit, occlusion, parts, obstacles);
}

function renderPlane(
  plane: SpacePlane,
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  fit: { scale: number; cx: number; cy: number },
  occlusion: OcclusionContext,
  parts: string[],
  obstacles: Obstacle[],
): void {
  if (!plane.style.visible || !plane.built) return;
  const section = computeFaceOrPlaneSection(
    plane.id,
    figure,
    resolved.points,
    resolved.planes,
    resolved.basis,
  );
  if (!section || section.length < 3) return;

  renderPlaneFillPolygon(
    section,
    plane.style.color,
    data.appearance.planeFillOpacity,
    data,
    figure,
    resolved,
    fit,
    parts,
  );
  renderPlaneSectionEdges(section, plane, data, figure, resolved, fit, occlusion, parts, obstacles);
  renderPlaneHelperLines(plane, section, data, figure, resolved, fit, occlusion, parts, obstacles);
}

function pointSegDist(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-18) return len(sub(p, a));
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return len(sub(p, add(a, scale(ab, t))));
}

/** Непрозрачность заливки плоскостей в режиме глубины. */
const DEPTH_PLANE_FILL_OPACITY = 0.45;

/**
 * Рисование плоскостей «художником» от дальних фрагментов к ближним.
 * Каждый фрагмент заливается и сразу получает свои рёбра: либо часть контура
 * сечения, либо отрезок пересечения с другой плоскостью (ровно сторона
 * многоугольника-фрагмента). Ближние фрагменты, нарисованные позже, своей
 * заливкой приглушают линии, лежащие за ними.
 */
function renderPlanesByDepth(
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  fit: { scale: number; cx: number; cy: number },
  occlusion: OcclusionContext,
  parts: string[],
  obstacles: Obstacle[],
): void {
  const visiblePlanes = data.planes.filter((p) => p.built && p.style.visible);
  const planeById = new Map(visiblePlanes.map((p) => [p.id, p]));
  const sections = new Map<string, Vec3[]>();
  let sizeRef = 0;
  for (const plane of visiblePlanes) {
    const section = computeFaceOrPlaneSection(
      plane.id,
      figure,
      resolved.points,
      resolved.planes,
      resolved.basis,
    );
    if (section && section.length >= 3) {
      sections.set(plane.id, section);
      for (const v of section) sizeRef = Math.max(sizeRef, len(sub(v, section[0]!)));
    }
  }
  const eps = Math.max(1e-6, sizeRef * 1e-5);
  const onBoundary = (a: Vec3, b: Vec3, section: Vec3[]) => {
    for (let i = 0; i < section.length; i += 1) {
      const s0 = section[i]!;
      const s1 = section[(i + 1) % section.length]!;
      if (pointSegDist(a, s0, s1) < eps && pointSegDist(b, s0, s1) < eps) return true;
    }
    return false;
  };

  const fragments = collectPlaneFillFragments(data, figure, resolved, (world) =>
    projectWorldWithDepth(world, resolved, data.view, fit, figure),
  );
  const width = data.appearance.lineWidth;
  const drawnBoundary = new Set<string>();
  const key = (a: Vec3, b: Vec3) => {
    const pa = projectWorld(a, resolved, data.view, fit, figure);
    const pb = projectWorld(b, resolved, data.view, fit, figure);
    const s1 = `${Math.round(pa.x * 2)},${Math.round(pa.y * 2)}`;
    const s2 = `${Math.round(pb.x * 2)},${Math.round(pb.y * 2)}`;
    return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
  };

  for (const fragment of fragments) {
    const plane = planeById.get(fragment.planeId);
    if (!plane) continue;
    renderPlaneFillPolygon(
      fragment.vertices,
      fragment.color,
      DEPTH_PLANE_FILL_OPACITY,
      data,
      figure,
      resolved,
      fit,
      parts,
    );
    const section = sections.get(plane.id);
    const vs = fragment.vertices;
    for (let i = 0; i < vs.length; i += 1) {
      const a = vs[i]!;
      const b = vs[(i + 1) % vs.length]!;
      if (len(sub(b, a)) < eps) continue;
      if (section && onBoundary(a, b, section)) {
        const k = `${plane.id}:${key(a, b)}`;
        if (drawnBoundary.has(k)) continue;
        drawnBoundary.add(k);
        drawSegmentWithVisibility(
          a,
          b,
          figure,
          resolved,
          data.view,
          fit,
          occlusion,
          plane.style.color,
          width,
          data.appearance.hiddenDash,
          parts,
          obstacles,
          undefined,
          false,
          isPyramid(figure),
          true,
        );
        continue;
      }
    }
  }

  // Для каждой конкретной пары используем только две зафиксированные точки,
  // в которых её прямая пересекает грани тела. Автоматическая линия всегда
  // пунктирная: видимость, совпадение с рёбрами и экранные эвристики здесь
  // намеренно не участвуют.
  for (let i = 0; i < visiblePlanes.length; i += 1) {
    const first = visiblePlanes[i]!;
    const firstEq = resolved.planes.get(first.id);
    if (!firstEq) continue;
    for (let j = i + 1; j < visiblePlanes.length; j += 1) {
      const second = visiblePlanes[j]!;
      const secondEq = resolved.planes.get(second.id);
      if (!secondEq) continue;
      const carrier = intersectPlanes(firstEq, secondEq);
      if (!carrier) continue;
      const range = planeIntersectionSegmentRange(
        carrier,
        first.id,
        second.id,
        figure,
        resolved.points,
        resolved.planes,
        resolved.basis,
      );
      if (!range || range.t1 - range.t0 <= eps) continue;
      const a = add(carrier.origin, scale(carrier.dir, range.t0));
      const b = add(carrier.origin, scale(carrier.dir, range.t1));
      const pa = projectWorld(a, resolved, data.view, fit, figure);
      const pb = projectWorld(b, resolved, data.view, fit, figure);
      parts.push(
        `<line x1="${round(pa.x)}" y1="${round(pa.y)}" x2="${round(pb.x)}" y2="${round(pb.y)}" stroke="${first.style.color}" stroke-width="${width}" stroke-dasharray="${data.appearance.hiddenDash}" stroke-linecap="round"/>`,
      );
      obstacles.push(lineObstacle(pa.x, pa.y, pb.x, pb.y, "helper"));
    }
  }
}

/** Отладочные лучи: от центра (и вершины пирамиды) через экран к проекции «глаза». */
function renderViewConvergenceRays(
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
  fit: { scale: number; cx: number; cy: number },
  width: number,
  height: number,
  parts: string[],
): void {
  const observer = buildSchoolViewObserver(figure, resolved, resolved.projection);
  const centerWorld = figureBodyCenterWorld(figure, resolved);
  const anchors: Vec3[] = [centerWorld];
  if (isPyramid(figure)) {
    const apex = figure.vertices.find((v) => v.id.startsWith("pyr-v-apex"));
    const aw = apex ? resolved.points.get(apex.id)?.world : null;
    if (aw) anchors.push(aw);
  }

  const displayCtx = displayCtxFromResolved(resolved);
  /**
   * «Глаз» — фиксированный читатель чертежа: его экранное положение не должно
   * зависеть от поворота основания (yaw) и не должно определяться через
   * геометрию самой фигуры (эллипс основания/вершину) — это оказалось
   * ненадёжно дважды подряд:
   *  1) общая аффинная формула (u,v,w)→(x,y,z) для точки типа (4,4,1) не имеет
   *     однозначного «вперёд» (эллипс подогнан произвольно) — стреляла в
   *     произвольную сторону, вплоть до «за кадр»;
   *  2) луч «вершина S → центр основания», продолженный наружу, ВЫРОЖДАЕТСЯ
   *     в почти нулевой вектор для пирамид с вершиной над центром основания
   *     (частый случай): экранная «база» апекса (без учёта высоты) совпадает
   *     с центром эллипса основания, а центроид ЧЁТНОГО числа вершин основания
   *     на эллипсе — тоже центр эллипса, так что «S → центр» — вектор длины
   *     ~0, и вся точка сваливалась внутрь фигуры.
   * Поэтому здесь просто фиксированная точка у нижнего края холста, по центру:
   * подгонка сцены (`fitSpaceProjection`) и так кладёт фигуру по центру
   * по ширине и основанием ближе к низу, так что «низ холста» надёжно
   * означает «к зрителю/вперёд» для любой фигуры, без зависимости от yaw,
   * формы основания или положения вершины.
   */
  let pEye: { x: number; y: number };
  if (isPyramid(figure)) {
    pEye = { x: width / 2, y: height * 0.94 };
  } else {
    const prEye = projectWorldOffFigureBody(
      observer.eye,
      { ...displayCtx, projection: { ...displayCtx.projection, yawRad: 0 } },
      data.view,
      figure,
    );
    pEye = { x: prEye.x * fit.scale + fit.cx, y: prEye.y * fit.scale + fit.cy };
  }
  const rayLen = Math.max(width, height) * 1.4;
  const stroke =
    'stroke="#B91C1C" stroke-width="1.25" stroke-dasharray="10 7" stroke-linecap="round" stroke-opacity="0.9"';

  for (const anchorWorld of anchors) {
    const p0 = projectWorld(anchorWorld, resolved, data.view, fit, figure);
    const dx = pEye.x - p0.x;
    const dy = pEye.y - p0.y;
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    parts.push(
      `<line x1="${round(p0.x)}" y1="${round(p0.y)}" x2="${round(p0.x + ux * rayLen)}" y2="${round(p0.y + uy * rayLen)}" fill="none" ${stroke}/>`,
    );
  }

  const eye = observer.eye;
  const eyeLabel = isPyramid(figure)
    ? `к зрителю (глаз ≈ (${round(eye.x)}, ${round(eye.y)}, ${round(eye.z)}))`
    : `глаз (${round(eye.x)}, ${round(eye.y)}, ${round(eye.z)})`;
  parts.push(
    `<circle cx="${round(pEye.x)}" cy="${round(pEye.y)}" r="5" fill="none" stroke="#B91C1C" stroke-width="1.25"/>`,
    `<circle cx="${round(pEye.x)}" cy="${round(pEye.y)}" r="2" fill="#B91C1C"/>`,
    `<text x="${round(pEye.x + 7)}" y="${round(pEye.y - 8)}" font-size="10" fill="#B91C1C" font-family="sans-serif">${eyeLabel}</text>`,
  );
}

function collectFitPoints(
  data: SpaceSceneData,
  figure: SpaceFigure,
  resolved: ResolvedSpaceScene,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (const v of figure.vertices) {
    const pr = resolved.projected.get(v.id);
    if (pr) pts.push({ x: pr.x, y: pr.y });
  }
  for (const point of data.points) {
    if (!point.built) continue;
    const pr = resolved.projected.get(point.id);
    if (pr) pts.push({ x: pr.x, y: pr.y });
  }
  const ellipse = sampleRotationEllipse(resolved.projection);
  for (const p of ellipse) {
    pts.push({ x: p.x * data.view.scale, y: -p.y * data.view.scale });
  }

  for (const line of data.lines) {
    if (!line.built) continue;
    const carrier = resolveLineCarrier(line, figure, resolved.points, resolved.planes, data.lines);
    if (!carrier) continue;
    const def = line.definition;
    let t0 = -1;
    let t1 = 1;
    if (def.kind === "twoPoints") {
      const a = resolved.points.get(def.aId)?.world;
      const b = resolved.points.get(def.bId)?.world;
      if (!a || !b) continue;
      const abLen = len(sub(b, a));
      t0 = 0;
      t1 = abLen;
    } else {
      const clip = planeIntersectionSegmentRange(
        carrier,
        def.planeAId,
        def.planeBId,
        figure,
        resolved.points,
        resolved.planes,
        resolved.basis,
      );
      if (!clip) continue;
      t0 = clip.t0;
      t1 = clip.t1;
      if (line.style.visualKind === "line" && !isPyramid(figure)) {
        const span = Math.max(t1 - t0, 1e-6);
        const ext = data.appearance.lineExtension * span;
        t0 -= ext;
        t1 += ext;
      }
    }
    let fitT0 = t0;
    let fitT1 = t1;
    if (def.kind === "twoPoints") {
      const a = resolved.points.get(def.aId)?.world;
      const b = resolved.points.get(def.bId)?.world;
      if (a && b) {
        fitT0 = 0;
        fitT1 = len(sub(b, a));
      }
    }
    const local0 = worldToLocal(add(carrier.origin, scale(carrier.dir, fitT0)), resolved.basis);
    const local1 = worldToLocal(add(carrier.origin, scale(carrier.dir, fitT1)), resolved.basis);
    if (local0) {
      const pr = projectFromLocalCoeffs(
        local0,
        add(carrier.origin, scale(carrier.dir, fitT0)),
        data.view,
        resolved.projection,
        figure,
      );
      pts.push({ x: pr.x, y: pr.y });
    }
    if (local1) {
      const pr = projectFromLocalCoeffs(
        local1,
        add(carrier.origin, scale(carrier.dir, fitT1)),
        data.view,
        resolved.projection,
        figure,
      );
      pts.push({ x: pr.x, y: pr.y });
    }
  }
  return pts;
}

export function renderSpaceSvg(data: SpaceSceneData): string | null {
  if (!data.figure) return null;
  const resolved = buildSpaceScene(data);
  const figure = resolved.figure ?? data.figure;
  const a = data.appearance;

  const hasFixedFit =
    data.view.fitScale != null && data.view.fitCx != null && data.view.fitCy != null;
  const fit = hasFixedFit
    ? { scale: data.view.fitScale!, cx: data.view.fitCx!, cy: data.view.fitCy! }
    : fitSpaceProjection(
        collectFitPoints(data, figure, resolved),
        a.width,
        a.height,
        a.padding,
      );

  const parts: string[] = [];
  const obstacles: Obstacle[] = [];
  const occlusion = buildOcclusionContext(figure, resolved, data.view);
  const projectWorldForFit = (world: Vec3) => projectWorld(world, resolved, data.view, fit, figure);
  const overlaySegments = collectVisibleOverlaySegments(
    data,
    figure,
    resolved,
    data.view,
    fit,
    occlusion,
    projectWorldForFit,
  );

  if (data.view.showRotationEllipse) {
    const ellipsePts = sampleRotationEllipse(resolved.projection);
    const d = ellipsePts
      .map((p) => {
        const sx = p.x * data.view.scale * fit.scale + fit.cx;
        const sy = -p.y * data.view.scale * fit.scale + fit.cy;
        return `${round(sx)},${round(sy)}`;
      })
      .join(" ");
    parts.push(
      `<polyline points="${d}" fill="none" stroke="#9CA3AF" stroke-width="${Math.max(1, a.edgeWidth / 2)}" stroke-dasharray="6 4" stroke-linecap="round"/>`,
    );
  }

  for (const edge of figure.edges) {
    const wa = resolved.points.get(edge.aId)?.world;
    const wb = resolved.points.get(edge.bId)?.world;
    if (!wa || !wb) continue;
    const p1 = projectWorld(wa, resolved, data.view, fit, figure);
    const p2 = projectWorld(wb, resolved, data.view, fit, figure);
    if (isEdgeCoveredOnScreen({ a: p1, b: p2 }, overlaySegments)) continue;
    const visible = isBodyEdgeVisibleForRender(edge.id, figure, resolved, data.view);
    const dash = visible ? "" : ` stroke-dasharray="${a.hiddenDash}"`;
    parts.push(
      `<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${a.edgeColor}" stroke-width="${a.edgeWidth}" stroke-linecap="round"${dash}/>`,
    );
    obstacles.push(lineObstacle(p1.x, p1.y, p2.x, p2.y, visible ? "curve" : "axis"));
  }

  if (data.view.planeFillByDepth) {
    renderPlanesByDepth(data, figure, resolved, fit, occlusion, parts, obstacles);
  } else {
    for (const plane of data.planes) {
      renderPlane(plane, data, figure, resolved, fit, occlusion, parts, obstacles);
    }
  }

  for (const line of data.lines) {
    renderLineObject(line, data, figure, resolved, fit, occlusion, parts, obstacles);
  }

  for (const point of data.points) {
    if (!point.style.visible || !point.built) continue;
    const pr = resolved.projected.get(point.id);
    if (!pr) continue;
    const px = pr.x * fit.scale + fit.cx;
    const py = pr.y * fit.scale + fit.cy;
    parts.push(
      `<circle cx="${round(px)}" cy="${round(py)}" r="${a.pointRadius}" fill="${point.style.color}" stroke="${point.style.color}" stroke-width="2"/>`,
    );
  }

  if (data.view.showViewConvergenceRays) {
    renderViewConvergenceRays(data, figure, resolved, fit, a.width, a.height, parts);
  }

  parts.push(`<g>${renderLabels(data, figure, resolved, obstacles, fit, a)}</g>`);

  const w = round(a.width);
  const h = round(a.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#FFFFFF"/>${parts.join("")}</svg>`;
}

export { buildSpaceScene };
