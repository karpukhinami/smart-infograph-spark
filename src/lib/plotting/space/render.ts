import { layoutLabels, measureTextWidth, type LabelRequest, type Obstacle, type Rect } from "../label-layout";
import {
  buildSpaceScene,
  computeLineDisplayRange,
  edgeVisible,
  outwardFaceNormal,
  resolveLineCarrier,
  type ResolvedSpaceScene,
} from "./build";
import { fitProjection, projectPoint, viewDirection } from "./camera";
import { splitLineByVisibility } from "./visibility";
import type { ParallelepipedFigure, SpaceLine, SpacePlane, SpaceSceneData, Vec3 } from "./types";
import { add, dot, len, lerp, planePointDistance, scale, sub } from "./vec3";
import type { PlaneEq } from "./vec3";

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

function project(
  world: Vec3,
  view: SpaceSceneData["view"],
  fit: { scale: number; cx: number; cy: number },
): { x: number; y: number } {
  const p = projectPoint(world, view);
  return { x: p.x * fit.scale + fit.cx, y: p.y * fit.scale + fit.cy };
}

function bodyCenter(figure: ParallelepipedFigure, resolved: ResolvedSpaceScene): Vec3 {
  const verts = figure.vertices
    .map((v) => resolved.points.get(v.id)?.world)
    .filter(Boolean) as Vec3[];
  return verts.length
    ? scale(verts.reduce((acc, v) => add(acc, v), { x: 0, y: 0, z: 0 }), 1 / verts.length)
    : { x: 0, y: 0, z: 0 };
}

function segmentOnFaceVisible(
  a: Vec3,
  b: Vec3,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  view: SpaceSceneData["view"],
): boolean {
  const center = bodyCenter(figure, resolved);
  const toCamera = viewDirection(view);
  for (const face of figure.faces) {
    const verts = face.vertexIds.map((id) => resolved.points.get(id)?.world).filter(Boolean) as Vec3[];
    if (verts.length < 4) continue;
    const onFace = verts.some((v) => len(sub(v, a)) < 1e-4 || len(sub(v, b)) < 1e-4);
    if (!onFace) continue;
    const n = outwardFaceNormal(face.vertexIds, resolved.points, center);
    if (n && dot(n, toCamera) > 1e-6) return true;
  }
  return true;
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

  const segments = splitLineByVisibility(origin, dir, t0, t1, figure, resolved, data.view);
  const sw = line.style.width ?? data.appearance.lineWidth;

  for (const seg of segments) {
    const p1 = project(seg.a, data.view, fit);
    const p2 = project(seg.b, data.view, fit);
    const dash = seg.visible ? "" : ` stroke-dasharray="${data.appearance.hiddenDash}"`;
    parts.push(
      `<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${line.style.color}" stroke-width="${sw}" stroke-linecap="round"${dash}/>`,
    );
    obstacles.push(lineObstacle(p1.x, p1.y, p2.x, p2.y, seg.visible ? "curve" : "helper"));
  }

  if (line.style.visualKind === "vector" && def.kind === "twoPoints") {
    const b = resolved.points.get(def.bId)?.world;
    if (b) {
      const p2 = project(b, data.view, fit);
      const a = resolved.points.get(def.aId)?.world;
      if (a) {
        const p1 = project(a, data.view, fit);
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

function computePlaneSection(
  plane: PlaneEq,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
): Vec3[] {
  const hits: Vec3[] = [];
  const seen = new Set<string>();
  const key = (p: Vec3) => `${p.x.toFixed(4)}:${p.y.toFixed(4)}:${p.z.toFixed(4)}`;

  for (const edge of figure.edges) {
    const a = resolved.points.get(edge.aId)?.world;
    const b = resolved.points.get(edge.bId)?.world;
    if (!a || !b) continue;
    const da = planePointDistance(a, plane);
    const db = planePointDistance(b, plane);
    if (Math.abs(da) < 1e-5 && !seen.has(key(a))) {
      seen.add(key(a));
      hits.push(a);
    }
    if (Math.abs(db) < 1e-5 && !seen.has(key(b))) {
      seen.add(key(b));
      hits.push(b);
    }
    if (da * db < -1e-10) {
      const p = lerp(a, b, da / (da - db));
      const k = key(p);
      if (!seen.has(k)) {
        seen.add(k);
        hits.push(p);
      }
    }
  }

  if (hits.length < 3) return hits;
  const cx = hits.reduce((s, p) => s + p.x, 0) / hits.length;
  const cy = hits.reduce((s, p) => s + p.y, 0) / hits.length;
  const cz = hits.reduce((s, p) => s + p.z, 0) / hits.length;
  return [...hits].sort((p1, p2) => {
    const a1 = Math.atan2(p1.y - cy, p1.x - cx);
    const a2 = Math.atan2(p2.y - cy, p2.x - cx);
    return a1 - a2;
  });
}

function renderPlane(
  plane: SpacePlane,
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  fit: { scale: number; cx: number; cy: number },
  parts: string[],
): void {
  if (!plane.style.visible || !plane.built) return;
  const eq = resolved.planes.get(plane.id);
  if (!eq) return;
  const section = computePlaneSection(eq, figure, resolved);
  if (section.length < 3) return;

  const screenPts = section.map((w) => project(w, data.view, fit));
  const poly = screenPts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
  const fillOpacity = data.appearance.planeFillOpacity;

  parts.push(
    `<polygon points="${poly}" fill="${plane.style.color}" fill-opacity="${fillOpacity}" stroke="none"/>`,
  );

  for (let i = 0; i < section.length; i += 1) {
    const a = section[i]!;
    const b = section[(i + 1) % section.length]!;
    const visible = segmentOnFaceVisible(a, b, figure, resolved, data.view);
    const p1 = screenPts[i]!;
    const p2 = screenPts[(i + 1) % section.length]!;
    const dash = visible ? "" : ` stroke-dasharray="${data.appearance.hiddenDash}"`;
    parts.push(
      `<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${plane.style.color}" stroke-width="${data.appearance.lineWidth}" stroke-linecap="round"${dash}/>`,
    );
  }
}

export function renderSpaceSvg(data: SpaceSceneData): string | null {
  if (!data.figure) return null;
  const figure = data.figure;
  const resolved = buildSpaceScene(data);
  const a = data.appearance;

  const rawProjected = figure.vertices
    .map((v) => resolved.projected.get(v.id))
    .filter(Boolean)
    .map((p) => ({ x: p!.x, y: p!.y }));
  const fit = fitProjection(rawProjected, a.width, a.height, a.padding);

  const parts: string[] = [];
  const obstacles: Obstacle[] = [];

  for (const edge of figure.edges) {
    const pa = resolved.projected.get(edge.aId);
    const pb = resolved.projected.get(edge.bId);
    if (!pa || !pb) continue;
    const visible = edgeVisible(edge.aId, edge.bId, figure, resolved.points, data.view);
    const p1 = { x: pa.x * fit.scale + fit.cx, y: pa.y * fit.scale + fit.cy };
    const p2 = { x: pb.x * fit.scale + fit.cx, y: pb.y * fit.scale + fit.cy };
    const dash = visible ? "" : ` stroke-dasharray="${a.hiddenDash}"`;
    parts.push(
      `<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${a.edgeColor}" stroke-width="${a.edgeWidth}" stroke-linecap="round"${dash}/>`,
    );
    obstacles.push(lineObstacle(p1.x, p1.y, p2.x, p2.y, visible ? "curve" : "axis"));
  }

  for (const plane of data.planes) {
    renderPlane(plane, data, figure, resolved, fit, parts);
  }

  for (const point of data.points) {
    if (point.definition.kind !== "onLine" || !point.style.visible || !point.built) continue;
    const def = point.definition;
    const wa = resolved.points.get(def.pointAId)?.world;
    const wb = resolved.points.get(def.pointBId)?.world;
    if (!wa || !wb) continue;
    const ab = sub(wb, wa);
    const abLen = len(ab);
    if (!(abLen > 1e-9)) continue;
    const dir = scale(ab, 1 / abLen);
    const mw = resolved.points.get(point.id)?.world ?? wa;
    const tParam = dot(sub(mw, wa), dir);
    const ext = data.appearance.lineExtension * abLen;
    const t0 = Math.min(0, abLen, tParam) - ext;
    const t1 = Math.max(0, abLen, tParam) + ext;
    const segments = splitLineByVisibility(wa, dir, t0, t1, figure, resolved, data.view);
    for (const seg of segments) {
      const p1 = project(seg.a, data.view, fit);
      const p2 = project(seg.b, data.view, fit);
      const dash = seg.visible ? "" : ` stroke-dasharray="${a.hiddenDash}"`;
      parts.push(
        `<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${point.style.color}" stroke-width="${a.lineWidth}" stroke-linecap="round"${dash}/>`,
      );
    }
  }

  for (const line of data.lines) {
    renderLineObject(line, data, figure, resolved, fit, parts, obstacles);
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
