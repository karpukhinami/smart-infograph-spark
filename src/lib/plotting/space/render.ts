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
import type { SpaceFigure, SpaceLine, SpacePlane, SpaceSceneData, Vec3 } from "./types";
import { add, len, scale, sub, worldToLocal } from "./vec3";

function round(n: number): string {
  return String(Number(n.toFixed(2)));
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
    if (line.style.visualKind === "segment" || line.style.visualKind === "vector") {
      t0 = 0;
      t1 = abLen;
    } else {
      const range = computeLineDisplayRange(
        { origin, dir },
        resolved.points,
        0,
        abLen,
        data.appearance.lineExtension * abLen,
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
    const b = resolved.points.get(def.bId)?.world;
    if (b) {
      const p2 = projectWorld(b, resolved, data.view, fit, figure);
      const a = resolved.points.get(def.aId)?.world;
      if (a) {
        const p1 = projectWorld(a, resolved, data.view, fit, figure);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const l = Math.hypot(dx, dy) || 1;
        parts.push(
          `<polygon points="${round(p2.x)},${round(p2.y)} ${round(p2.x - (dx / l) * 10 - 4)},${round(p2.y - (dy / l) * 10 - 3)} ${round(p2.x - (dx / l) * 10 - 4)},${round(p2.y - (dy / l) * 10 + 3)}" fill="${line.style.color}"/>`,
        );
      }
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
      if (line.style.visualKind === "line") {
        const range = computeLineDisplayRange(
          carrier,
          resolved.points,
          0,
          abLen,
          data.appearance.lineExtension * abLen,
        );
        t0 = range.t0;
        t1 = range.t1;
      } else {
        t0 = 0;
        t1 = abLen;
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
      if (!clip) continue;
      t0 = clip.t0;
      t1 = clip.t1;
      if (line.style.visualKind === "line") {
        const span = Math.max(t1 - t0, 1e-6);
        const ext = data.appearance.lineExtension * span;
        t0 -= ext;
        t1 += ext;
      }
    }
    const local0 = worldToLocal(add(carrier.origin, scale(carrier.dir, t0)), resolved.basis);
    const local1 = worldToLocal(add(carrier.origin, scale(carrier.dir, t1)), resolved.basis);
    if (local0) {
      const pr = projectFromLocalCoeffs(
        local0,
        add(carrier.origin, scale(carrier.dir, t0)),
        data.view,
        resolved.projection,
        figure,
      );
      pts.push({ x: pr.x, y: pr.y });
    }
    if (local1) {
      const pr = projectFromLocalCoeffs(
        local1,
        add(carrier.origin, scale(carrier.dir, t1)),
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

  parts.push(`<g>${renderLabels(data, figure, resolved, obstacles, fit, a)}</g>`);

  const w = round(a.width);
  const h = round(a.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#FFFFFF"/>${parts.join("")}</svg>`;
}

export { buildSpaceScene };
