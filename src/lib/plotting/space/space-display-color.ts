import type { ResolvedSpaceScene } from "./build";
import type { SpacePlane, SpacePoint, SpaceSceneData, SpaceViewParams } from "./types";
import { planePointDistance } from "./vec3";

const ON_PLANE_EPS = 1e-3;

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const s = hex.trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(s) ?? /^#?([0-9a-f]{3})$/i.exec(s);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Яркость 0…255 для отображения «в градациях серого». */
export function colorToGrayscaleHex(color: string): string {
  const rgb = parseHexRgb(color);
  if (!rgb) return color;
  const lum = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
  const g = Math.max(0, Math.min(255, lum));
  const hex = g.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

export function spaceDisplayColor(color: string, view: SpaceViewParams): string {
  if (!view.renderGrayscale) return color;
  return colorToGrayscaleHex(color);
}

/** Точки на плоскости наследуют её цвет; при нескольких плоскостях — последняя в списке. */
export function syncPointColorsFromPlanes(
  points: SpacePoint[],
  planes: SpacePlane[],
  resolved: ResolvedSpaceScene,
): SpacePoint[] {
  const colorByPointId = new Map<string, string>();
  for (const plane of planes) {
    if (!plane.built) continue;
    const eq = resolved.planes.get(plane.id);
    if (!eq) continue;
    for (const point of points) {
      if (!point.built) continue;
      const world = resolved.points.get(point.id)?.world;
      if (!world) continue;
      if (Math.abs(planePointDistance(world, eq)) > ON_PLANE_EPS) continue;
      colorByPointId.set(point.id, plane.style.color);
    }
  }
  if (!colorByPointId.size) return points;
  return points.map((p) => {
    const c = colorByPointId.get(p.id);
    if (!c || p.style.color === c) return p;
    return { ...p, style: { ...p.style, color: c } };
  });
}

export function spacePointLabelColor(
  pointId: string,
  data: SpaceSceneData,
  edgeColor: string,
  defaultLabelColor: string,
): string {
  const point = data.points.find((p) => p.id === pointId);
  if (!point) return defaultLabelColor;
  if (data.view.pointLabelsUseEdgeColor !== false) return edgeColor;
  return point.style.color;
}
