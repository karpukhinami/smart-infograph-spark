import { nextId, DEFAULT_APPEARANCE, PLOT_PALETTE } from "../shared";
import { DEFAULT_SPACE_VIEW, fitProjection, projectPoint } from "./camera";
import { parseBaseVertexLabels, formatVertexLabel } from "./parse-vertices";
import { createParallelepiped } from "./parallelepiped";
import { buildSpaceScene, clampRegionParam, defaultLineParam, getPointLabel } from "./build";
import { cross, len, sub, type Vec3 } from "./vec3";
import type {
  LineRegion,
  ParallelepipedConstraints,
  ParallelepipedFigure,
  PointOnLineDefinition,
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

const GREEK_PLANE_LABELS = "αβγδεζηθικλμνξοπρστυφχψω".split("");

export const DEFAULT_SPACE_APPEARANCE: SpaceAppearance = {
  width: DEFAULT_APPEARANCE.width,
  height: DEFAULT_APPEARANCE.height,
  padding: 24,
  edgeWidth: DEFAULT_APPEARANCE.graphWidth,
  edgeColor: DEFAULT_APPEARANCE.axisColor,
  hiddenDash: "20 14",
  labelFontSize: DEFAULT_APPEARANCE.pointLabelFontSize,
  labelFontFamily: DEFAULT_APPEARANCE.pointLabelFontFamily,
  labelColor: DEFAULT_APPEARANCE.labelColor,
  pointRadius: DEFAULT_APPEARANCE.pointRadius,
  lineWidth: DEFAULT_APPEARANCE.graphWidth,
  lineExtension: 0.35,
  planeFillOpacity: 0.5,
};

export function createSpaceSceneData(): SpaceSceneData {
  return {
    shapeKind: null,
    baseVerticesInput: "",
    figureConstraints: { rectangular: true, equilateral: false },
    figureDirty: false,
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
    built: false,
    geometry: null,
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
      width: DEFAULT_SPACE_APPEARANCE.lineWidth,
      visible: true,
      visualKind: "segment",
    },
    built: false,
    dirty: true,
    error: null,
    lastOk: false,
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
    built: false,
    dirty: true,
    error: null,
    lastOk: false,
  };
}

export function createParallelepipedFromInput(
  input: string,
  constraints?: ParallelepipedConstraints,
): {
  figure: ParallelepipedFigure | null;
  error: string | null;
} {
  const labels = parseBaseVertexLabels(input);
  if (!labels) {
    return { figure: null, error: "Введите четыре различные буквы вершин нижнего основания." };
  }
  return {
    figure: createParallelepiped(
      labels as [string, string, string, string],
      constraints ?? { rectangular: true, equilateral: false },
    ),
    error: null,
  };
}

export interface SpaceBuildReport {
  data: SpaceSceneData;
  built: number;
  errors: string[];
}

export function autoLineLabel(
  line: SpaceLine,
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
): string {
  const def = line.definition;
  if (def.kind === "twoPoints") {
    const a = getPointLabel(def.aId, data, figure);
    const b = getPointLabel(def.bId, data, figure);
    return `${a}${b}`;
  }
  return nextAutoLineLabel(data.lines.filter((l) => l.id !== line.id));
}

export function autoPlaneLabel(
  plane: SpacePlane,
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
): string {
  const def = plane.definition;
  if (def.kind === "threePoints") {
    const a = getPointLabel(def.aId, data, figure);
    const b = getPointLabel(def.bId, data, figure);
    const c = getPointLabel(def.cId, data, figure);
    return `(${a}${b}${c})`;
  }
  return nextGreekPlaneLabel(data.planes.filter((p) => p.id !== plane.id));
}

export function collectUsedPointLabels(
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
): Set<string> {
  const used = new Set<string>();
  for (const v of figure.vertices) used.add(v.label);
  for (const p of data.points) {
    if (p.label.trim()) used.add(p.label.trim());
  }
  return used;
}

/** Первая свободная латинская буква; при исчерпании — буква с индексом. */
export function nextFreePointLabel(data: SpaceSceneData, figure: ParallelepipedFigure): string {
  const used = collectUsedPointLabels(data, figure);
  for (let c = 65; c <= 90; c += 1) {
    const ch = String.fromCharCode(c);
    if (!used.has(ch)) return ch;
  }
  for (let sub = 1; sub < 20; sub += 1) {
    for (let c = 65; c <= 90; c += 1) {
      const ch = String.fromCharCode(c);
      const label = formatVertexLabel(ch, sub);
      if (!used.has(label)) return label;
    }
  }
  return formatVertexLabel("M", data.points.length + 1);
}

export function findLineThroughPoints(
  data: SpaceSceneData,
  aId: string,
  bId: string,
): SpaceLine | undefined {
  return data.lines.find((line) => {
    if (line.definition.kind !== "twoPoints") return false;
    const { aId: la, bId: lb } = line.definition;
    return (la === aId && lb === bId) || (la === bId && lb === aId);
  });
}

const COLLINEAR_EPS = 1e-5;

function pointsCollinearWithCarrier(a: Vec3, b: Vec3, c: Vec3, d: Vec3): boolean {
  const cd = sub(d, c);
  if (len(cd) < 1e-9) return false;
  return len(cross(sub(a, c), cd)) < COLLINEAR_EPS && len(cross(sub(b, c), cd)) < COLLINEAR_EPS;
}

/** Носитель через две точки уже есть (пользовательская прямая или ребро тела). */
export function hasCarrierThroughPoints(
  data: SpaceSceneData,
  figure: ParallelepipedFigure,
  aId: string,
  bId: string,
): boolean {
  if (findLineThroughPoints(data, aId, bId)) return true;
  if (
    figure.edges.some(
      (e) => (e.aId === aId && e.bId === bId) || (e.aId === bId && e.bId === aId),
    )
  ) {
    return true;
  }

  const resolved = buildSpaceScene(data);
  const pa = resolved.points.get(aId)?.world;
  const pb = resolved.points.get(bId)?.world;
  if (!pa || !pb) return false;

  for (const edge of figure.edges) {
    const ea = resolved.points.get(edge.aId)?.world;
    const eb = resolved.points.get(edge.bId)?.world;
    if (ea && eb && pointsCollinearWithCarrier(pa, pb, ea, eb)) return true;
  }

  for (const line of data.lines) {
    if (line.definition.kind !== "twoPoints") continue;
    const { aId: la, bId: lb } = line.definition;
    const wa = resolved.points.get(la)?.world;
    const wb = resolved.points.get(lb)?.world;
    if (wa && wb && pointsCollinearWithCarrier(pa, pb, wa, wb)) return true;
  }

  return false;
}

/** Вспомогательная прямая/отрезок при построении точки на носителе AB. */
export function createAuxiliaryLineForPoint(
  data: SpaceSceneData,
  def: PointOnLineDefinition,
): SpaceLine | null {
  if (!data.figure) return null;
  if (hasCarrierThroughPoints(data, data.figure, def.pointAId, def.pointBId)) return null;
  const visualKind = def.region === "between" ? "segment" : "line";
  const line = createSpaceLine(
    data.lines.length + 1,
    { kind: "twoPoints", aId: def.pointAId, bId: def.pointBId },
    "",
  );
  line.style.visualKind = visualKind;
  line.built = true;
  line.dirty = false;
  return line;
}

export function buildSpaceSceneData(data: SpaceSceneData): SpaceBuildReport {
  const resolved = buildSpaceScene(data);
  const errors = [...resolved.errors];
  let built = 0;

  const points = data.points.map((point) => {
    const err = resolved.pointErrors.get(point.id);
    const geom = resolved.points.get(point.id) ?? null;
    if (geom && point.built) built += 1;
    if (err) errors.push(`Точка ${point.label || point.index}: ${err}`);
    return {
      ...point,
      geometry: point.built ? (geom ?? point.lastBuilt) : null,
      lastBuilt: geom ?? point.lastBuilt,
      error: err ?? null,
      dirty: err ? point.dirty : point.built ? false : point.dirty,
    };
  });

  const lines = data.lines.map((line) => {
    const err = resolved.lineErrors.get(line.id);
    if (err) errors.push(`Прямая ${line.label || line.index}: ${err}`);
    const ok = !err && line.built;
    if (ok) built += 1;
    const label =
      line.built && ok
        ? line.label.trim() || (data.figure ? autoLineLabel(line, { ...data, points }, data.figure) : "")
        : line.label;
    return {
      ...line,
      label: label || line.label,
      error: err ?? null,
      lastOk: ok,
      dirty: err ? line.dirty : false,
    };
  });

  const planes = data.planes.map((plane) => {
    const err = resolved.planeErrors.get(plane.id);
    if (err) errors.push(`Плоскость ${plane.label || plane.index}: ${err}`);
    const ok = !err && plane.built && resolved.planes.has(plane.id);
    if (ok) built += 1;
    const label =
      plane.built && ok && data.figure
        ? plane.label.trim() || autoPlaneLabel(plane, { ...data, points }, data.figure)
        : plane.label;
    return { ...plane, label: label || plane.label, error: err ?? null, lastOk: ok, dirty: err ? plane.dirty : false };
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
    if (p.built) result.push({ id: p.id, label: p.label || `T${p.index}` });
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

/** Грани параллелепипеда + построенные плоскости (для пересечений). */
export function planeChoices(data: SpaceSceneData): Array<{ id: string; label: string }> {
  const faces = faceChoices(data);
  const custom = data.planes
    .filter((p) => p.built)
    .map((p) => ({ id: p.id, label: p.label || `П${p.index}` }));
  return [...faces, ...custom];
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

export function nextGreekPlaneLabel(planes: SpacePlane[]): string {
  const used = new Set(planes.map((p) => p.label));
  for (const g of GREEK_PLANE_LABELS) {
    if (!used.has(g)) return g;
  }
  return `π${planes.length + 1}`;
}
