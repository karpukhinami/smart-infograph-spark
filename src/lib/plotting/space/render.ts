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
import { fitSpaceProjection, sampleRotationEllipse } from "./camera";
import { projectWorldDisplay, type DisplayProjectionContext } from "./display-projection";
import { collectVisibleOverlaySegments, isEdgeCoveredOnScreen } from "./edge-overlay";
import { collectPlaneFillFragments } from "./plane-subdivision";
import {
  buildOcclusionContext,
  isBodyEdgeVisibleForRender,
  splitLineForRender,
  type OcclusionContext,
} from "./visibility";
import { isPyramid } from "./figure";
import { buildSchoolViewObserver, figureBodyCenterWorld } from "./pyramid-view";
import type { SpaceFigure, SpaceLine, SpacePlane, SpaceSceneData, Vec3 } from "./types";
import { add, len, scale, sub, worldToLocal } from "./vec3";

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
): void {
  const dir = sub(bWorld, aWorld);
  const abLen = len(dir);
  if (!(abLen > 1e-9)) return;
  const unit = scale(dir, 1 / abLen);
  const segments = splitLineForRender(aWorld, unit, 0, abLen, figure, resolved, view, occlusion);
  const opacityAttr =
    strokeOpacity !== undefined && strokeOpacity < 1
      ? ` stroke-opacity="${strokeOpacity}"`
      : "";
  for (const seg of segments) {
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

  /** Направление лучей зрения на экране: toViewer в 3D, не proj(далёкого eye). */
  const pCenter = projectWorld(centerWorld, resolved, data.view, fit, figure);
  const pViewStep = projectWorld(
    add(centerWorld, scale(observer.toViewer, 0.35)),
    resolved,
    data.view,
    fit,
    figure,
  );
  let dx = pViewStep.x - pCenter.x;
  let dy = pViewStep.y - pCenter.y;
  if (Math.hypot(dx, dy) < 1e-6) {
    dx = 0;
    dy = -1;
  }
  const rayLen = Math.max(width, height) * 1.3;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const stroke =
    'stroke="#B91C1C" stroke-width="1.25" stroke-dasharray="10 7" stroke-linecap="round" stroke-opacity="0.9"';

  for (const anchorWorld of anchors) {
    const p0 = projectWorld(anchorWorld, resolved, data.view, fit, figure);
    parts.push(
      `<line x1="${round(p0.x - ux * rayLen)}" y1="${round(p0.y - uy * rayLen)}" x2="${round(p0.x + ux * rayLen)}" y2="${round(p0.y + uy * rayLen)}" fill="none" ${stroke}/>`,
    );
  }

  const eye = observer.eye;
  const tipX = Math.min(width - 8, pCenter.x + ux * 48);
  const tipY = Math.min(height - 8, pCenter.y + uy * 48);
  parts.push(
    `<circle cx="${round(tipX)}" cy="${round(tipY)}" r="4" fill="none" stroke="#B91C1C" stroke-width="1.25"/>`,
    `<text x="${round(tipX + 6)}" y="${round(tipY - 6)}" font-size="10" fill="#B91C1C" font-family="sans-serif">E (${round(eye.x)}, ${round(eye.y)}, ${round(eye.z)})</text>`,
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
    const fragments = collectPlaneFillFragments(data, figure, resolved);
    const planeById = new Map(data.planes.map((p) => [p.id, p]));
    for (const fragment of fragments) {
      const plane = planeById.get(fragment.planeId);
      if (!plane?.built || !plane.style.visible) continue;
      renderPlaneFillPolygon(
        fragment.vertices,
        fragment.color,
        a.planeFillOpacity,
        data,
        figure,
        resolved,
        fit,
        parts,
      );
      renderPlaneSectionEdges(
        fragment.vertices,
        plane,
        data,
        figure,
        resolved,
        fit,
        occlusion,
        parts,
        obstacles,
      );
    }
    for (const plane of data.planes) {
      if (!plane.style.visible || !plane.built) continue;
      const section = computeFaceOrPlaneSection(
        plane.id,
        figure,
        resolved.points,
        resolved.planes,
        resolved.basis,
      );
      if (section && section.length >= 3) {
        renderPlaneHelperLines(plane, section, data, figure, resolved, fit, occlusion, parts, obstacles);
      }
    }
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
