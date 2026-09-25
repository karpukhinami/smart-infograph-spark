import { nextId, DEFAULT_APPEARANCE, PLOT_PALETTE } from "../shared";
import { computeSpaceViewFit, DEFAULT_SPACE_VIEW, fitProjection, projectPoint } from "./camera";
import { parseBaseVertexLabels, parsePrismBaseLabels, parsePyramidVertexLabels } from "./parse-vertices";
import { nextAvailableVertexLabel, normalizeUserPointLabel } from "./vertex-label-normalize";
import { faceDisplayLabel } from "./figure";
import { createParallelepiped } from "./parallelepiped";
import { createPyramid } from "./pyramid";
import { createPrism } from "./prism";
import {
  buildSpaceScene,
  clampRegionParam,
  defaultLineParam,
  getPointLabel,
  planeIntersectionSegmentRange,
  resolveLineCarrier,
} from "./build";
import { cross, intersectPlanes, len, segmentPlaneIntersection, sub } from "./vec3";
import type {
  LineRegion,
  ParallelepipedConstraints,
  PrismConstraints,
  PyramidConstraints,
  SpaceFigure,
  SpaceFigureConstraints,
  SpaceShapeKind,
  PointOnLineDefinition,
  SpaceAppearance,
  SpaceLine,
  SpaceLineDefinition,
  SpacePlane,
  SpacePlaneDefinition,
  SpacePoint,
  Vec3,
  SpacePointDefinition,
  SpaceSceneData,
} from "./types";

const GREEK_PLANE_LABELS = "αβγδεζηθικλμνξοπρστυφχψω".split("");

export const DEFAULT_SPACE_APPEARANCE: SpaceAppearance = {
  width: DEFAULT_APPEARANCE.width,
  height: DEFAULT_APPEARANCE.height,
  padding: 24,
  edgeWidth: DEFAULT_APPEARANCE.graphWidth,
  edgeColor: DEFAULT_APPEARANCE.axisColor,
  /** Единый шаблон пунктира (dash gap) для рёбер, прямых и границ сечений. */
  hiddenDash: "8 6",
  labelFontSize: DEFAULT_APPEARANCE.pointLabelFontSize,
  labelFontFamily: DEFAULT_APPEARANCE.pointLabelFontFamily,
  labelColor: DEFAULT_APPEARANCE.labelColor,
  pointRadius: DEFAULT_APPEARANCE.pointRadius,
  lineWidth: DEFAULT_APPEARANCE.graphWidth,
  lineExtension: 0.35,
  arrowSize: DEFAULT_APPEARANCE.arrowSize,
  // Достаточно плотная заливка: при разбиении плоскости на фрагменты по
  // глубине их экранные проекции нередко перекрываются (см. render.ts) —
  // при полупрозрачной заливке 0.5 в зоне перекрытия оба цвета смешиваются
  // почти поровну, и ближний фрагмент визуально не «побеждает» дальний.
  // При такой непрозрачности верхний (ближний) фрагмент чётко перекрывает
  // нижний, а сквозь заливку всё равно видны линии и точки чертежа.
  planeFillOpacity: 0.82,
};

export function createSpaceSceneData(): SpaceSceneData {
  return {
    shapeKind: null,
    baseVerticesInput: "",
    figureConstraints: { rectangular: true, equilateral: false, badAngleDeg: 35 },
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
  figure: SpaceFigure | null;
  error: string | null;
} {
  const labels = parseBaseVertexLabels(input);
  if (!labels) {
    return { figure: null, error: "Введите четыре различные буквы вершин нижнего основания." };
  }
  return {
    figure: createParallelepiped(
      labels as [string, string, string, string],
      constraints ?? { rectangular: true, equilateral: false, badAngleDeg: 35 },
    ),
    error: null,
  };
}

export function createPyramidFromInput(
  input: string,
  constraints?: PyramidConstraints,
): { figure: import("./types").PyramidFigure | null; error: string | null } {
  const parsed = parsePyramidVertexLabels(input);
  if (!parsed) {
    return {
      figure: null,
      error: "Введите минимум 4 различные буквы: первая — вершина, остальные — основание.",
    };
  }
  return {
    figure: createPyramid(parsed.apex, parsed.base, constraints ?? defaultPyramidConstraints()),
    error: null,
  };
}

export function defaultPyramidConstraints(): PyramidConstraints {
  return { apexOnCenter: true, equilateral: false, badAngleDeg: 35 };
}

export function defaultPrismConstraints(): PrismConstraints {
  return { straight: false, equilateral: false, badAngleDeg: 35 };
}

export function createPrismFromInput(
  input: string,
  constraints?: PrismConstraints,
): { figure: import("./types").PrismFigure | null; error: string | null } {
  const labels = parsePrismBaseLabels(input);
  if (!labels) {
    return {
      figure: null,
      error: "Введите минимум 3 различные буквы вершин нижнего основания.",
    };
  }
  return {
    figure: createPrism(labels, constraints ?? defaultPrismConstraints()),
    error: null,
  };
}

export function defaultParallelepipedConstraints(): ParallelepipedConstraints {
  return { rectangular: true, equilateral: false, badAngleDeg: 35 };
}

/** Строка вершин для поля ввода после нормализации подписей. */
export function figureVertexInputString(figure: SpaceFigure): string {
  if (figure.kind === "pyramid") {
    return [figure.apexLabel, ...figure.baseLabels].join(", ");
  }
  if (figure.kind === "prism") {
    return figure.baseLabels.join(", ");
  }
  return figure.baseLabels.join(", ");
}

export function createFigureFromInput(
  shapeKind: SpaceShapeKind,
  input: string,
  constraints: SpaceFigureConstraints,
): { figure: SpaceFigure | null; error: string | null } {
  if (shapeKind === "pyramid") {
    return createPyramidFromInput(input, constraints as PyramidConstraints);
  }
  if (shapeKind === "prism") {
    return createPrismFromInput(input, constraints as PrismConstraints);
  }
  return createParallelepipedFromInput(input, constraints as ParallelepipedConstraints);
}

export interface SpaceBuildReport {
  data: SpaceSceneData;
  built: number;
  errors: string[];
}

export type DerivedPointChoice =
  | { id: string; label: string; kind: "planeEdge"; planeId: string; edgeId: string }
  | { id: string; label: string; kind: "planePair"; planeAId: string; planeBId: string };

export type DerivedLineChoice = {
  id: string;
  label: string;
  planeAId: string;
  planeBId: string;
};

function canonicalPlanePair(aId: string, bId: string): [string, string] {
  return aId < bId ? [aId, bId] : [bId, aId];
}

function planePairKey(aId: string, bId: string): string {
  const [first, second] = canonicalPlanePair(aId, bId);
  return `planes:${first}:${second}`;
}

function planeDisplayLabel(data: SpaceSceneData, id: string): string {
  const plane = data.planes.find((item) => item.id === id);
  return plane?.label.trim() || (plane ? `П${plane.index}` : "?");
}

export function derivedPointChoices(data: SpaceSceneData): DerivedPointChoice[] {
  if (!data.figure) return [];
  const resolved = buildSpaceScene(data);
  const choices: DerivedPointChoice[] = [];
  const builtPlanes = data.planes.filter((plane) => plane.built && resolved.planes.has(plane.id));

  for (const plane of builtPlanes) {
    const eq = resolved.planes.get(plane.id);
    if (!eq) continue;
    const seenHits: Vec3[] = [];
    for (const edge of data.figure.edges) {
      const a = resolved.points.get(edge.aId)?.world;
      const b = resolved.points.get(edge.bId)?.world;
      if (!a || !b) continue;
      const hit = segmentPlaneIntersection(a, b, eq);
      if (!hit || seenHits.some((existing) => len(sub(existing, hit)) <= 1e-7)) continue;
      seenHits.push(hit);
      const alreadyAdded = data.points.some((point) =>
        point.definition.kind === "planeEdgeIntersection"
        && point.definition.planeId === plane.id
        && point.definition.edgeId === edge.id,
      );
      if (alreadyAdded) continue;
      choices.push({
        id: `edge:${plane.id}:${edge.id}`,
        label: `${planeDisplayLabel(data, plane.id)} ∩ ${getPointLabel(edge.aId, data, data.figure)}${getPointLabel(edge.bId, data, data.figure)}`,
        kind: "planeEdge",
        planeId: plane.id,
        edgeId: edge.id,
      });
    }
  }

  for (let i = 0; i < builtPlanes.length; i += 1) {
    const first = builtPlanes[i]!;
    for (let j = i + 1; j < builtPlanes.length; j += 1) {
      const second = builtPlanes[j]!;
      const [planeAId, planeBId] = canonicalPlanePair(first.id, second.id);
      const aEq = resolved.planes.get(planeAId);
      const bEq = resolved.planes.get(planeBId);
      if (!aEq || !bEq) continue;
      const carrier = intersectPlanes(aEq, bEq);
      if (!carrier) continue;
      const range = planeIntersectionSegmentRange(
        carrier,
        planeAId,
        planeBId,
        data.figure,
        resolved.points,
        resolved.planes,
        resolved.basis,
      );
      if (!range) continue;
      const endpoints = data.points.filter((point) =>
        point.definition.kind === "planeIntersectionBoundary"
        && planePairKey(point.definition.planeAId, point.definition.planeBId) === planePairKey(planeAId, planeBId),
      );
      if (endpoints.length >= 2) continue;
      choices.push({
        id: planePairKey(planeAId, planeBId),
        label: `${planeDisplayLabel(data, planeAId)} ∩ ${planeDisplayLabel(data, planeBId)} → две граничные точки`,
        kind: "planePair",
        planeAId,
        planeBId,
      });
    }
  }
  return choices;
}

export function derivedLineChoices(data: SpaceSceneData): DerivedLineChoice[] {
  if (!data.figure) return [];
  const resolved = buildSpaceScene(data);
  const planes = data.planes.filter((plane) => plane.built && resolved.planes.has(plane.id));
  const choices: DerivedLineChoice[] = [];
  for (let i = 0; i < planes.length; i += 1) {
    for (let j = i + 1; j < planes.length; j += 1) {
      const [planeAId, planeBId] = canonicalPlanePair(planes[i]!.id, planes[j]!.id);
      const id = planePairKey(planeAId, planeBId);
      if (data.lines.some((line) =>
        line.definition.kind === "planeIntersection"
        && planePairKey(line.definition.planeAId, line.definition.planeBId) === id,
      )) continue;
      const aEq = resolved.planes.get(planeAId);
      const bEq = resolved.planes.get(planeBId);
      const carrier = aEq && bEq ? intersectPlanes(aEq, bEq) : null;
      if (!carrier) continue;
      const range = planeIntersectionSegmentRange(
        carrier,
        planeAId,
        planeBId,
        data.figure,
        resolved.points,
        resolved.planes,
        resolved.basis,
      );
      if (!range) continue;
      choices.push({
        id,
        label: `${planeDisplayLabel(data, planeAId)} ∩ ${planeDisplayLabel(data, planeBId)}`,
        planeAId,
        planeBId,
      });
    }
  }
  return choices;
}

export function createDerivedPoints(data: SpaceSceneData, choice: DerivedPointChoice): SpacePoint[] {
  if (!data.figure) return [];
  if (choice.kind === "planeEdge") {
    const point = createSpacePoint(data.points.length + 1, {
      kind: "planeEdgeIntersection",
      planeId: choice.planeId,
      edgeId: choice.edgeId,
    }, nextFreePointLabel(data, data.figure));
    point.built = true;
    return [point];
  }

  const result: SpacePoint[] = [];
  let working = data;
  for (const endpoint of [0, 1] as const) {
    const exists = working.points.some((point) =>
      point.definition.kind === "planeIntersectionBoundary"
      && planePairKey(point.definition.planeAId, point.definition.planeBId)
        === planePairKey(choice.planeAId, choice.planeBId)
      && point.definition.endpoint === endpoint,
    );
    if (exists) continue;
    const point = createSpacePoint(working.points.length + 1, {
      kind: "planeIntersectionBoundary",
      planeAId: choice.planeAId,
      planeBId: choice.planeBId,
      endpoint,
    }, nextFreePointLabel(working, data.figure));
    point.built = true;
    result.push(point);
    working = { ...working, points: [...working.points, point] };
  }
  return result;
}

export function autoLineLabel(
  line: SpaceLine,
  data: SpaceSceneData,
  figure: SpaceFigure,
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
  figure: SpaceFigure,
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
  figure: SpaceFigure,
): Set<string> {
  const used = new Set<string>();
  for (const v of figure.vertices) used.add(v.label);
  for (const p of data.points) {
    if (p.label.trim()) used.add(p.label.trim());
  }
  return used;
}

/** Первая свободная латинская буква; при исчерпании — буква с индексом. */
export function nextFreePointLabel(data: SpaceSceneData, figure: SpaceFigure): string {
  const used = collectUsedPointLabels(data, figure);
  return nextAvailableVertexLabel(used);
}

/** Нормализует введённую подпись точки с учётом занятых имён. */
export function resolvePointLabelInput(
  raw: string,
  data: SpaceSceneData,
  figure: SpaceFigure,
): string {
  const used = collectUsedPointLabels(data, figure);
  const normalized = normalizeUserPointLabel(raw, used);
  return normalized || nextAvailableVertexLabel(used);
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
  figure: SpaceFigure,
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

/** Две точки на концах отрезка пересечения плоскостей внутри параллелепипеда. */
export function createPlaneIntersectionEndpoints(
  data: SpaceSceneData,
  line: SpaceLine,
): SpacePoint[] {
  if (!data.figure || line.definition.kind !== "planeIntersection") return [];
  const withLine = data.lines.some((l) => l.id === line.id)
    ? data
    : { ...data, lines: [...data.lines, line] };
  const [planeAId, planeBId] = canonicalPlanePair(
    line.definition.planeAId,
    line.definition.planeBId,
  );
  const choice = derivedPointChoices(withLine).find((item) =>
    item.kind === "planePair" && item.planeAId === planeAId && item.planeBId === planeBId,
  );
  if (!choice || choice.kind !== "planePair") return [];
  const endpoints = createDerivedPoints(data, choice);
  for (const point of endpoints) point.style.color = line.style.color;
  return endpoints;
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

  const viewFit = data.figure
    ? computeSpaceViewFit({ ...data, points, lines, planes }, data.appearance)
    : null;
  const view = viewFit ? { ...data.view, ...viewFit } : data.view;

  return {
    data: { ...data, points, lines, planes, view },
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
  return data.figure.faces.map((f) => ({
    id: f.id,
    label: faceDisplayLabel(data.figure!, f),
  }));
}

/** Рёбра параллелепипеда (AB, …) + построенные прямые. */
export function lineChoices(data: SpaceSceneData): Array<{ id: string; label: string }> {
  if (!data.figure) return [];
  const figure = data.figure;
  const edges = figure.edges.map((e) => ({
    id: e.id,
    label: `${getPointLabel(e.aId, data, figure)}${getPointLabel(e.bId, data, figure)}`,
  }));
  const lines = data.lines
    .filter((l) => l.built)
    .map((l) => ({
      id: l.id,
      label: l.label.trim() || autoLineLabel(l, data, figure),
    }));
  return [...edges, ...lines];
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

export function newPointAtLinePlaneIntersection(
  data: SpaceSceneData,
  lineId: string,
  planeId: string,
  label: string,
): SpacePoint {
  return createSpacePoint(data.points.length + 1, {
    kind: "linePlaneIntersection",
    lineId,
    planeId,
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
