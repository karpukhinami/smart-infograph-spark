import { layoutLabels, measureTextWidth, type LabelRequest, type Obstacle, type Rect } from "../label-layout";
import {
  buildSpaceScene,
  computeLineDisplayRange,
  edgeVisible,
  resolveLineCarrier,
  type ResolvedSpaceScene,
} from "./build";
import { projectPoint } from "./camera";
import { splitLineByVisibility } from "./visibility";
import type {
  ParallelepipedFigure,
  SpaceLine,
  SpaceSceneData,
} from "./types";
import { add, dot, lerp, planePointDistance, scale, sub } from "./vec3";
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

function renderLabels(
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
  obstacles: Obstacle[],
  cx: number,
  cy: number,
): string {
  const a = data.appearance;
  const area: Rect = {
    x: cx - a.width / 2 + a.padding,
    y: cy - a.height / 2 + a.padding,
    width: a.width - a.padding * 2,
    height: a.height - a.padding * 2,
  };
  const requests: LabelRequest[] = [];

  for (const vertex of figure.vertices) {
    const pr = resolved.projected.get(vertex.id);
    if (!pr) continue;
    const text = vertex.label;
    requests.push({
      id: vertex.id,
      anchorX: pr.x + cx,
      anchorY: pr.y + cy,
      width: measureTextWidth(text, a.labelFontSize),
      height: a.labelFontSize * 1.12,
      gap: a.pointRadius + 16,
    });
  }

  for (const point of data.points) {
    if (!point.style.visible) continue;
    const pr = resolved.projected.get(point.id);
    if (!pr) continue;
    const text = point.label;
    if (!text) continue;
    requests.push({
      id: point.id,
      anchorX: pr.x + cx,
      anchorY: pr.y + cy,
      width: measureTextWidth(text, a.labelFontSize),
      height: a.labelFontSize * 1.12,
      gap: a.pointRadius + 16,
      placement: point.style.labelPlacement,
    });
  }

  const placed = layoutLabels(requests, obstacles, area, { fontSize: a.labelFontSize });
  return placed
    .map((item) => {
      const color =
        figure.vertices.find((v) => v.id === item.id)?.label != null
          ? a.labelColor
          : data.points.find((p) => p.id === item.id)?.style.color ?? a.labelColor;
      const text = figure.vertices.find((v) => v.id === item.id)?.label ??
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
  cx: number,
  cy: number,
  parts: string[],
  obstacles: Obstacle[],
): void {
  if (!line.style.visible) return;
  const carrier = resolveLineCarrier(line, figure, resolved.points, resolved.planes, data.lines);
  if (!carrier) return;
  const def = line.definition;
  let t0 = 0;
  let t1 = 1;
  if (def.kind === "twoPoints") {
    const a = resolved.points.get(def.aId)?.world;
    const b = resolved.points.get(def.bId)?.world;
    if (!a || !b) return;
    const ta = 0;
    const tb = 1;
    if (line.style.visualKind === "segment" || line.style.visualKind === "vector") {
      t0 = ta;
      t1 = tb;
    } else {
      const range = computeLineDisplayRange(
        carrier,
        resolved.points,
        ta,
        tb,
        data.appearance.lineExtension,
      );
      t0 = range.t0;
      t1 = range.t1;
    }
  } else {
    const range = computeLineDisplayRange(carrier, resolved.points, -2, 2, data.appearance.lineExtension);
    t0 = range.t0;
    t1 = range.t1;
  }

  const segments = splitLineByVisibility(
    carrier.origin,
    carrier.dir,
    t0,
    t1,
    figure,
    resolved,
    data.view,
  );

  for (const seg of segments) {
    const p1 = projectPoint(seg.a, data.view);
    const p2 = projectPoint(seg.b, data.view);
    const x1 = p1.x + cx;
    const y1 = p1.y + cy;
    const x2 = p2.x + cx;
    const y2 = p2.y + cy;
    const dash = seg.visible ? "" : ` stroke-dasharray="${data.appearance.hiddenDash}"`;
    parts.push(
      `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${line.style.color}" stroke-width="${line.style.width}" stroke-linecap="round"${dash}/>`,
    );
    obstacles.push(lineObstacle(x1, y1, x2, y2, seg.visible ? "curve" : "helper"));
  }

  if (line.style.visualKind === "vector" && def.kind === "twoPoints") {
    const a = resolved.points.get(def.aId)?.world;
    const b = resolved.points.get(def.bId)?.world;
    if (a && b) {
      const p2 = projectPoint(b, data.view);
      const p1 = projectPoint(a, data.view);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const ax = p2.x + cx - (dx / len) * 10;
      const ay = p2.y + cy - (dy / len) * 10;
      const bx = p2.x + cx;
      const by = p2.y + cy;
      parts.push(
        `<polygon points="${round(bx)},${round(by)} ${round(ax - 4)},${round(ay - 3)} ${round(ax - 4)},${round(ay + 3)}" fill="${line.style.color}"/>`,
      );
    }
  }
}

function computePlaneSection(
  plane: PlaneEq,
  figure: ParallelepipedFigure,
  resolved: ResolvedSpaceScene,
): import("./types").Vec3[] {
  const hits: import("./types").Vec3[] = [];
  const seen = new Set<string>();
  const key = (p: import("./types").Vec3) =>
    `${p.x.toFixed(4)}:${p.y.toFixed(4)}:${p.z.toFixed(4)}`;

  for (const edge of figure.edges) {
    const a = resolved.points.get(edge.aId)?.world;
    const b = resolved.points.get(edge.bId)?.world;
    if (!a || !b) continue;
    const da = planePointDistance(a, plane);
    const db = planePointDistance(b, plane);
    if (Math.abs(da) < 1e-5) {
      if (!seen.has(key(a))) {
        seen.add(key(a));
        hits.push(a);
      }
    }
    if (Math.abs(db) < 1e-5) {
      if (!seen.has(key(b))) {
        seen.add(key(b));
        hits.push(b);
      }
    }
    if (da * db < -1e-10) {
      const t = da / (da - db);
      const p = lerp(a, b, t);
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
  const ux = plane.normal.y;
  const uy = -plane.normal.x;
  const uz = plane.normal.z;
  return [...hits].sort((p1, p2) => {
    const a1 = Math.atan2(
      (p1.y - cy) * ux + (p1.x - cx) * uy,
      (p1.z - cz) * uz + (p1.x - cx),
    );
    const a2 = Math.atan2(
      (p2.y - cy) * ux + (p2.x - cx) * uy,
      (p2.z - cz) * uz + (p2.x - cx),
    );
    return a1 - a2;
  });
}

export function renderSpaceSvg(data: SpaceSceneData): string | null {
  if (!data.figure) return null;
  const figure = data.figure;
  const resolved = buildSpaceScene(data);
  const a = data.appearance;
  const w = a.width;
  const h = a.height;
  const cx = w / 2;
  const cy = h / 2;
  const parts: string[] = [];
  const obstacles: Obstacle[] = [];

  // Рёбра параллелепипеда.
  for (const edge of figure.edges) {
    const pa = resolved.projected.get(edge.aId);
    const pb = resolved.projected.get(edge.bId);
    if (!pa || !pb) continue;
    const visible = edgeVisible(edge.aId, edge.bId, figure, resolved.points, data.view);
    const x1 = pa.x + cx;
    const y1 = pa.y + cy;
    const x2 = pb.x + cx;
    const y2 = pb.y + cy;
    const dash = visible ? "" : ` stroke-dasharray="${a.hiddenDash}"`;
    parts.push(
      `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${a.edgeColor}" stroke-width="${a.edgeWidth}" stroke-linecap="round"${dash}/>`,
    );
    obstacles.push(lineObstacle(x1, y1, x2, y2, visible ? "curve" : "axis"));
  }

  // Автоматические продолжения носителей для точек «на прямой».
  for (const point of data.points) {
    if (point.definition.kind !== "onLine" || !point.style.visible) continue;
    const def = point.definition;
    const wa = resolved.points.get(def.pointAId)?.world;
    const wb = resolved.points.get(def.pointBId)?.world;
    if (!wa || !wb) continue;
    const ab = sub(wb, wa);
    const abLen = Math.hypot(ab.x, ab.y, ab.z);
    if (!(abLen > 1e-9)) continue;
    const carrier = { origin: wa, dir: { x: ab.x / abLen, y: ab.y / abLen, z: ab.z / abLen } };
    const mw = resolved.points.get(point.id)?.world ?? wa;
    const tParam = dot(sub(mw, wa), carrier.dir);
    const ext = data.appearance.lineExtension * abLen;
    const t0 = Math.min(0, abLen, tParam) - ext;
    const t1 = Math.max(0, abLen, tParam) + ext;
    const segments = splitLineByVisibility(
      carrier.origin,
      carrier.dir,
      t0,
      t1,
      figure,
      resolved,
      data.view,
    );
    for (const seg of segments) {
      const p1 = projectPoint(seg.a, data.view);
      const p2 = projectPoint(seg.b, data.view);
      const x1 = p1.x + cx;
      const y1 = p1.y + cy;
      const x2 = p2.x + cx;
      const y2 = p2.y + cy;
      const dash = seg.visible ? "" : ` stroke-dasharray="${a.hiddenDash}" opacity="0.55"`;
      parts.push(
        `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${point.style.color}" stroke-width="1.5" stroke-linecap="round"${dash}/>`,
      );
    }
  }

  // Сечения плоскостей с параллелепипедом.
  for (const plane of data.planes) {
    if (!plane.style.visible) continue;
    const eq = resolved.planes.get(plane.id);
    if (!eq) continue;
    const section = computePlaneSection(eq, figure, resolved);
    if (section.length >= 3) {
      const pts = section
        .map((w) => {
          const p = projectPoint(w, data.view);
          return `${round(p.x + cx)},${round(p.y + cy)}`;
        })
        .join(" ");
      parts.push(
        `<polygon points="${pts}" fill="none" stroke="${plane.style.color}" stroke-width="2" stroke-linejoin="round"/>`,
      );
    }
  }

  // Пользовательские прямые.
  for (const line of data.lines) {
    renderLineObject(line, data, figure, resolved, cx, cy, parts, obstacles);
  }

  // Маркеры точек (кроме подписей вершин — они только текстом).
  for (const point of data.points) {
    if (!point.style.visible) continue;
    const pr = resolved.projected.get(point.id);
    if (!pr) continue;
    parts.push(
      `<circle cx="${round(pr.x + cx)}" cy="${round(pr.y + cy)}" r="${a.pointRadius}" fill="${point.style.color}" stroke="${point.style.color}" stroke-width="2"/>`,
    );
  }

  const labels = renderLabels(data, figure, resolved, obstacles, cx, cy);
  parts.push(`<g>${labels}</g>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#FFFFFF"/>${parts.join("")}</svg>`;
}

export { buildSpaceScene };
