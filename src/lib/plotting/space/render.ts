import { layoutLabels, measureTextWidth, type LabelRequest, type Obstacle, type Rect } from "../label-layout";
import {
  buildSpaceScene,
  computeFaceOrPlaneSection,
  computeLineDisplayRange,
  planeIntersectionSegmentRange,
  resolveLineCarrier,
  type ResolvedSpaceScene,
} from "./build";
import { fitProjection, projectFromLocalCoeffs } from "./camera";
import {
  buildOcclusionContext,
  isBodyEdgeVisibleForRender,
  splitLineForRender,
  type OcclusionContext,
} from "./visibility";
import type { ParallelepipedFigure, SpaceLine, SpacePlane, SpaceSceneData, Vec3 } from "./types";
import { add, len, scale, sub, worldToLocal } from "./vec3";

const BACKDROP_OPACITY = 0.85;
const BACKDROP_STROKE = 4;

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
  figure: ParallelepipedFigure,
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
  const dir = sub(bWorld, aWorld);
  const abLen = len(dir);
  if (!(abLen > 1e-9)) return;
  const unit = scale(dir, 1 / abLen);
  const segments = splitLineForRender(aWorld, unit, 0, abLen, figure, resolved, view, occlusion);
  for (const seg of segments) {
    const p1 = projectWorld(seg.a, resolved, view, fit);
    const p2 = projectWorld(seg.b, resolved, view, fit);
    const dash = seg.visible ? "" : ` stroke-dasharray="${hiddenDash}"`;
    parts.push(
      `<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${dash}/>`,
    );
    obstacles.push(lineObstacle(p1.x, p1.y, p2.x, p2.y, seg.visible ? "curve" : "helper"));
  }
}

function drawCarrierWithVisibility(
  origin: Vec3,
  dir: Vec3,
  t0: number,
  t1: number,
  figure: ParallelepipedFigure,
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

function projectWorld(
  world: Vec3,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
  fit: { scale: number; cx: number; cy: number },
): { x: number; y: number } {
  const local = worldToLocal(world, resolved.basis);
  const pr = local
    ? projectFromLocalCoeffs(local, world, view)
    : { x: 0, y: 0 };
  return { x: pr.x * fit.scale + fit.cx, y: pr.y * fit.scale + fit.cy };
}

function renderLabels(
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
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

  return layoutLabels(requests, obstacles, area, { fontSize: a.labelFontSize })
    .map((item) => {
      const color =
        figure.vertices.some((v) => v.id === item.id)
          ? a.labelColor
          : data.points.find((p) => p.id === item.id)?.style.color ?? a.labelColor;
      const text =
        figure.vertices.find((v) => v.id === item.id)?.label ??
        data.points.find((p) => p.id === item.id)?.label ??
        "";
      const backdrop = item.needsBackdrop
        ? `<text x="${round(item.x)}" y="${round(item.y)}" text-anchor="${item.textAnchor}" font-family="${escapeText(a.labelFontFamily)}" font-size="${a.labelFontSize}" fill="#FFFFFF" fill-opacity="${BACKDROP_OPACITY}" stroke="#FFFFFF" stroke-opacity="${BACKDROP_OPACITY}" stroke-width="${BACKDROP_STROKE}" stroke-linejoin="round" paint-order="stroke fill">${escapeText(text)}</text>`
        : "";
      return `${backdrop}<text x="${round(item.x)}" y="${round(item.y)}" text-anchor="${item.textAnchor}" font-family="${escapeText(a.labelFontFamily)}" font-size="${a.labelFontSize}" fill="${color}" font-style="italic">${escapeText(text)}</text>`;
    })
    .join("");
}

function renderLineObject(
  line: SpaceLine,
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
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
    if (clip) {
      t0 = clip.t0;
      t1 = clip.t1;
    } else {
      const range = computeLineDisplayRange(
        carrier,
        resolved.points,
        -2,
        2,
        data.appearance.lineExtension,
      );
      t0 = range.t0;
      t1 = range.t1;
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
      const p2 = projectWorld(b, resolved, data.view, fit);
      const a = resolved.points.get(def.aId)?.world;
      if (a) {
        const p1 = projectWorld(a, resolved, data.view, fit);
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

function renderPlane(
  plane: SpacePlane,
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
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

  const screenPts = section.map((w) => projectWorld(w, resolved, data.view, fit));
  const poly = screenPts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
  const fillOpacity = data.appearance.planeFillOpacity;

  parts.push(
    `<polygon points="${poly}" fill="${plane.style.color}" fill-opacity="${fillOpacity}" stroke="none"/>`,
  );

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
      data.appearance.lineWidth,
      data.appearance.hiddenDash,
      parts,
      obstacles,
    );
  }
}

function collectFitPoints(
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
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
      if (clip) {
        t0 = clip.t0;
        t1 = clip.t1;
      }
    }
    const local0 = worldToLocal(add(carrier.origin, scale(carrier.dir, t0)), resolved.basis);
    const local1 = worldToLocal(add(carrier.origin, scale(carrier.dir, t1)), resolved.basis);
    if (local0) {
      const pr = projectFromLocalCoeffs(local0, add(carrier.origin, scale(carrier.dir, t0)), data.view);
      pts.push({ x: pr.x, y: pr.y });
    }
    if (local1) {
      const pr = projectFromLocalCoeffs(local1, add(carrier.origin, scale(carrier.dir, t1)), data.view);
      pts.push({ x: pr.x, y: pr.y });
    }
  }
  return pts;
}

export function renderSpaceSvg(data: SpaceSceneData): string | null {
  if (!data.figure) return null;
  const figure = data.figure;
  const resolved = buildSpaceScene(data);
  const a = data.appearance;

  const fit = fitProjection(collectFitPoints(data, figure, resolved), a.width, a.height, a.padding);

  const parts: string[] = [];
  const obstacles: Obstacle[] = [];
  const occlusion = buildOcclusionContext(figure, resolved, data.view);

  for (const edge of figure.edges) {
    const wa = resolved.points.get(edge.aId)?.world;
    const wb = resolved.points.get(edge.bId)?.world;
    if (!wa || !wb) continue;
    const visible = isBodyEdgeVisibleForRender(edge.id, figure, data.view);
    const p1 = projectWorld(wa, resolved, data.view, fit);
    const p2 = projectWorld(wb, resolved, data.view, fit);
    const dash = visible ? "" : ` stroke-dasharray="${a.hiddenDash}"`;
    parts.push(
      `<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${a.edgeColor}" stroke-width="${a.edgeWidth}" stroke-linecap="round"${dash}/>`,
    );
    obstacles.push(lineObstacle(p1.x, p1.y, p2.x, p2.y, visible ? "curve" : "axis"));
  }

  for (const plane of data.planes) {
    renderPlane(plane, data, figure, resolved, fit, occlusion, parts, obstacles);
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
