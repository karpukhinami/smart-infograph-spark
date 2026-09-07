import { nextId, PLOT_PALETTE } from "../scene";
import { DEFAULT_SPACE_VIEW } from "./camera";
import { parseBaseVertexLabels } from "./parse-vertices";
import { createParallelepiped } from "./parallelepiped";
import { buildSpaceScene, clampRegionParam, defaultLineParam } from "./build";
import type {
  LineRegion,
  ParallelepipedFigure,
  SpaceAppearance,
  SpaceLine,
  SpaceLineDefinition,
  SpacePlane,
  SpacePlaneDefinition,
  SpacePoint,
  SpacePointDefinition,
  SpaceSceneData,
  SpaceShapeKind,
} from "./types";

export const DEFAULT_SPACE_APPEARANCE: SpaceAppearance = {
  width: 720,
  height: 520,
  padding: 40,
  edgeWidth: 2.5,
  edgeColor: "#1A2236",
  hiddenDash: "6 5",
  labelFontSize: 16,
  labelFontFamily: "Segoe UI, sans-serif",
  labelColor: "#1A2236",
  pointRadius: 5,
  lineExtension: 0.45,
};

export function createSpaceSceneData(): SpaceSceneData {
  return {
    shapeKind: null,
    baseVerticesInput: "",
    figure: null,
    points: [],
    lines: [],
    planes: [],
    view: { ...DEFAULT_SPACE_VIEW },
    appearance: { ...DEFAULT_SPACE_APPEARANCE },
  };
}

export function createSpacePoint(index: number, definition: SpacePointDefinition, label = ""): SpacePoint {
  return {
    id: nextId("spoint"),
    index,
    label,
    definition,
    style: { color: PLOT_PALETTE[(index - 1) % PLOT_PALETTE.length]!, visible: true },
    built: null,
    lastBuilt: null,
    dirty: true,
    error: null,
  };
}

export function createSpaceLine(
  index: number,
  definition: SpaceLineDefinition,
  label = "",
): SpaceLine {
  return {
    id: nextId("sline"),
    index,
    label,
    definition,
    style: {
      color: PLOT_PALETTE[(index - 1) % PLOT_PALETTE.length]!,
      width: 2,
      visible: true,
      visualKind: "segment",
    },
    error: null,
    lastOk: true,
  };
}

export function createSpacePlane(
  index: number,
  definition: SpacePlaneDefinition,
  label = "",
): SpacePlane {
  return {
    id: nextId("splane"),
    index,
    label,
    definition,
    style: { color: PLOT_PALETTE[(index - 1) % PLOT_PALETTE.length]!, visible: true, helperOpacity: 0.45 },
    error: null,
    lastOk: true,
  };
}

export function createParallelepipedFromInput(input: string): {
  figure: ParallelepipedFigure | null;
  error: string | null;
} {
  const labels = parseBaseVertexLabels(input);
  if (!labels) {
    return { figure: null, error: "Введите четыре различные буквы вершин нижнего основания." };
  }
  return {
    figure: createParallelepiped(labels as [string, string, string, string]),
    error: null,
  };
}

export interface SpaceBuildReport {
  data: SpaceSceneData;
  built: number;
  errors: string[];
}

export function buildSpaceSceneData(data: SpaceSceneData): SpaceBuildReport {
  const resolved = buildSpaceScene(data);
  const errors = [...resolved.errors];
  let built = 0;

  const points = data.points.map((point) => {
    const err = resolved.pointErrors.get(point.id);
    const builtPt = resolved.points.get(point.id) ?? null;
    if (builtPt) built += 1;
    if (err) errors.push(`Точка ${point.label || point.index}: ${err}`);
    return {
      ...point,
      built: builtPt,
      lastBuilt: builtPt ?? point.lastBuilt,
      error: err ?? null,
      dirty: false,
    };
  });

  const lines = data.lines.map((line) => {
    const err = resolved.lineErrors.get(line.id);
    if (err) errors.push(`Прямая ${line.label || line.index}: ${err}`);
    else built += 1;
    return { ...line, error: err ?? null, lastOk: !err };
  });

  const planes = data.planes.map((plane) => {
    const err = resolved.planeErrors.get(plane.id);
    if (err) errors.push(`Плоскость ${plane.label || plane.index}: ${err}`);
    else if (resolved.planes.has(plane.id)) built += 1;
    return { ...plane, error: err ?? null, lastOk: !err };
  });

  if (data.figure) built += data.figure.vertices.length + data.figure.edges.length;

  return {
    data: { ...data, points, lines, planes },
    built,
    errors,
  };
}

export function pointChoices(data: SpaceSceneData): Array<{ id: string; label: string }> {
  if (!data.figure) return [];
  const result = data.figure.vertices.map((v) => ({ id: v.id, label: v.label }));
  for (const p of data.points) {
    if (p.built || p.lastBuilt) result.push({ id: p.id, label: p.label || `T${p.index}` });
  }
  return result;
}

export function faceChoices(data: SpaceSceneData): Array<{ id: string; label: string }> {
  if (!data.figure) return [];
  const names: Record<string, string> = {
    "f-bottom": "нижнее основание",
    "f-top": "верхнее основание",
    "f-front": "передняя",
    "f-back": "задняя",
    "f-left": "левая",
    "f-right": "правая",
  };
  return data.figure.faces.map((f) => ({
    id: f.id,
    label: names[f.id] ?? f.id,
  }));
}

export function newPointOnLine(
  data: SpaceSceneData,
  pointAId: string,
  pointBId: string,
  label: string,
): SpacePoint {
  return createSpacePoint(data.points.length + 1, {
    kind: "onLine",
    pointAId,
    pointBId,
    region: "between",
    ratioMode: "auto",
    ratioA: 1,
    ratioB: 2,
    lineParam: defaultLineParam("between"),
  }, label);
}

export function newPointOnFace(data: SpaceSceneData, faceId: string, label: string): SpacePoint {
  return createSpacePoint(data.points.length + 1, {
    kind: "onFace",
    faceId,
    placement: "arbitrary",
    faceU: 0.35,
    faceV: 0.35,
  }, label);
}

export function updatePointRegion(point: SpacePoint, region: LineRegion): SpacePoint {
  if (point.definition.kind !== "onLine") return point;
  return {
    ...point,
    definition: {
      ...point.definition,
      region,
      lineParam: defaultLineParam(region),
    },
    dirty: true,
  };
}

export function updatePointLineParam(point: SpacePoint, lineParam: number): SpacePoint {
  if (point.definition.kind !== "onLine") return point;
  return {
    ...point,
    definition: {
      ...point.definition,
      lineParam: clampRegionParam(point.definition.region, lineParam),
      ratioMode: "auto",
    },
    dirty: true,
  };
}

export function setShapeKind(data: SpaceSceneData, kind: SpaceShapeKind | null): SpaceSceneData {
  if (kind !== "parallelepiped") return { ...data, shapeKind: kind, figure: null };
  return { ...data, shapeKind: kind };
}

export function reindexSpace<T extends { index: number }>(items: T[]): T[] {
  return items.map((item, i) => ({ ...item, index: i + 1 }));
}

export function nextAutoLineLabel(lines: SpaceLine[]): string {
  const used = new Set(lines.map((l) => l.label));
  for (const ch of "abcdefghijklmnopqrstuvwxyz") {
    if (!used.has(ch)) return ch;
  }
  return `l${lines.length + 1}`;
}
