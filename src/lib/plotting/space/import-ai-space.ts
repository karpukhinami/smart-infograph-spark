/**
 * Развёртывание упрощённого space3d от модели в полный SpaceSceneData.
 */
import { paletteColorFromGroup } from "../palette-color";
import {
  createFigureFromInput,
  createSpaceLine,
  createSpacePlane,
  createSpacePoint,
  createSpaceSceneData,
  defaultParallelepipedConstraints,
  defaultPrismConstraints,
  defaultPyramidConstraints,
} from "./scene";
import { getPointLabel } from "./build";
import { faceDisplayLabel } from "./figure";
import type {
  ParallelepipedConstraints,
  PrismConstraints,
  PyramidConstraints,
  SpaceFigure,
  SpaceFigureConstraints,
  SpaceLine,
  SpacePlane,
  SpacePoint,
  SpacePointDefinition,
  SpaceSceneData,
  SpaceShapeKind,
} from "./types";

type LooseDef = Record<string, unknown>;

function normalizeLabelKey(label: string): string {
  let s = label.trim().toUpperCase();
  const subs = "₀₁₂₃₄₅₆₇₈₉";
  for (let i = 0; i < subs.length; i += 1) {
    s = s.split(subs[i]!).join(String(i));
  }
  return s.replace(/\s+/g, "");
}

function figureConstraintsFromAi(
  shapeKind: SpaceShapeKind,
  raw: unknown,
): SpaceFigureConstraints {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (shapeKind === "pyramid") {
    const d = defaultPyramidConstraints();
    return {
      apexOnCenter: typeof o.apexOnCenter === "boolean" ? o.apexOnCenter : d.apexOnCenter,
      equilateral: d.equilateral,
      badAngleDeg: d.badAngleDeg,
    };
  }
  if (shapeKind === "prism") {
    const d = defaultPrismConstraints();
    return {
      straight: typeof o.straight === "boolean" ? o.straight : d.straight,
      equilateral: d.equilateral,
      badAngleDeg: d.badAngleDeg,
    };
  }
  const d = defaultParallelepipedConstraints();
  return {
    rectangular: typeof o.rectangular === "boolean" ? o.rectangular : d.rectangular,
    equilateral: d.equilateral,
    badAngleDeg: d.badAngleDeg,
  };
}

function resolvePointId(
  label: string,
  figure: SpaceFigure,
  data: SpaceSceneData,
  extraPoints: SpacePoint[],
): string {
  const key = normalizeLabelKey(label);
  for (const v of figure.vertices) {
    if (normalizeLabelKey(v.label) === key) return v.id;
  }
  for (const p of [...data.points, ...extraPoints]) {
    if (normalizeLabelKey(p.label) === key) return p.id;
  }
  throw new Error(`Не найдена точка или вершина с подписью «${label}»`);
}

function resolveLineId(
  lineIndex: number,
  lines: SpaceLine[],
): string {
  const line = lines.find((l) => l.index === lineIndex);
  if (!line) throw new Error(`Прямая с index=${lineIndex} не найдена`);
  return line.id;
}

function resolvePlaneId(planeIndex: number, planes: SpacePlane[]): string {
  const plane = planes.find((p) => p.index === planeIndex);
  if (!plane) throw new Error(`Плоскость с index=${planeIndex} не найдена`);
  return plane.id;
}

function resolveFaceId(figure: SpaceFigure, ref: string): string {
  const r = ref.trim().toLowerCase();
  const byId: Record<string, string> = {
    bottom: "f-bottom",
    base: "f-bottom",
    top: "f-top",
    front: "f-front",
    back: "f-back",
    left: "f-left",
    right: "f-right",
  };
  if (figure.kind === "parallelepiped" && byId[r]) return byId[r]!;

  if (figure.kind === "pyramid") {
    if (r === "base" || r === "bottom") return "pyr-f-base";
    const side = /^side:(\d+)$/.exec(r);
    if (side) return `pyr-f-side-${side[1]}`;
  }
  if (figure.kind === "prism") {
    if (r === "base" || r === "bottom") return "prism-f-base";
    if (r === "top") return "prism-f-top";
    const side = /^side:(\d+)$/.exec(r);
    if (side) return `prism-f-side-${side[1]}`;
  }

  const compact = ref.replace(/\s/g, "");
  for (const face of figure.faces) {
    if (faceDisplayLabel(figure, face).replace(/\s/g, "") === compact) return face.id;
  }
  throw new Error(`Грань «${ref}» не найдена`);
}

function resolveEdgeId(
  edgeRef: string,
  figure: SpaceFigure,
  data: SpaceSceneData,
): string {
  const letters = edgeRef.replace(/[^A-Za-zА-Яа-яЁё₀-₉0-9]/g, "");
  if (letters.length < 2) throw new Error(`Некорректное ребро «${edgeRef}»`);
  const a = letters[0]!;
  const b = letters[1]!;
  const wantA = normalizeLabelKey(a);
  const wantB = normalizeLabelKey(b);

  for (const edge of figure.edges) {
    const la = normalizeLabelKey(getPointLabel(edge.aId, data, figure));
    const lb = normalizeLabelKey(getPointLabel(edge.bId, data, figure));
    if ((la === wantA && lb === wantB) || (la === wantB && lb === wantA)) return edge.id;
  }
  throw new Error(`Ребро «${edgeRef}» не найдено на теле`);
}

function mapPointDefinition(
  def: LooseDef,
  figure: SpaceFigure,
  data: SpaceSceneData,
  lines: SpaceLine[],
  planes: SpacePlane[],
  pendingPoints: SpacePoint[],
): SpacePointDefinition {
  const kind = String(def.kind ?? "");
  switch (kind) {
    case "onLine":
      return {
        kind: "onLine",
        pointAId: resolvePointId(String(def.pointA ?? def.pointAId), figure, data, pendingPoints),
        pointBId: resolvePointId(String(def.pointB ?? def.pointBId), figure, data, pendingPoints),
        region: (def.region as "before" | "between" | "after") ?? "between",
        ratioMode: (def.ratioMode as "auto" | "explicit") ?? "auto",
        ratioA: Number(def.ratioA ?? 1),
        ratioB: Number(def.ratioB ?? 2),
        lineParam: Number(def.lineParam ?? 0.5),
      };
    case "onFace":
      return {
        kind: "onFace",
        faceId: resolveFaceId(figure, String(def.face ?? def.faceId ?? "bottom")),
        placement: (def.placement as "arbitrary" | "center") ?? "arbitrary",
        faceU: Number(def.faceU ?? 0.35),
        faceV: Number(def.faceV ?? 0.35),
      };
    case "onSpaceLine":
      return {
        kind: "onSpaceLine",
        lineId: resolveLineId(Number(def.lineIndex ?? def.lineId), lines),
        lineParam: Number(def.lineParam ?? 0),
      };
    case "linePlaneIntersection":
      return {
        kind: "linePlaneIntersection",
        lineId: resolveLineId(Number(def.lineIndex ?? def.lineId), lines),
        planeId: resolvePlaneId(Number(def.planeIndex ?? def.planeId), planes),
      };
    case "planeEdgeIntersection":
      return {
        kind: "planeEdgeIntersection",
        planeId: resolvePlaneId(Number(def.planeIndex ?? def.planeId), planes),
        edgeId: resolveEdgeId(String(def.edge ?? def.edgeId), figure, data),
      };
    case "planeIntersectionBoundary":
      return {
        kind: "planeIntersectionBoundary",
        planeAId: resolvePlaneId(Number(def.planeAIndex ?? def.planeAId), planes),
        planeBId: resolvePlaneId(Number(def.planeBIndex ?? def.planeBId), planes),
        endpoint: (def.endpoint === 1 ? 1 : 0) as 0 | 1,
      };
    default:
      throw new Error(`Неизвестный kind точки: ${kind}`);
  }
}

function mapLineDefinition(
  def: LooseDef,
  figure: SpaceFigure,
  data: SpaceSceneData,
  lines: SpaceLine[],
  planes: SpacePlane[],
  pendingPoints: SpacePoint[],
): SpaceLine["definition"] {
  const kind = String(def.kind ?? "twoPoints");
  if (kind === "planeIntersection") {
    return {
      kind: "planeIntersection",
      planeAId: resolvePlaneId(Number(def.planeAIndex ?? def.planeAId), planes),
      planeBId: resolvePlaneId(Number(def.planeBIndex ?? def.planeBId), planes),
    };
  }
  return {
    kind: "twoPoints",
    aId: resolvePointId(String(def.a ?? def.aId), figure, data, pendingPoints),
    bId: resolvePointId(String(def.b ?? def.bId), figure, data, pendingPoints),
  };
}

function mapPlaneDefinition(
  def: LooseDef,
  figure: SpaceFigure,
  data: SpaceSceneData,
  lines: SpaceLine[],
  pendingPoints: SpacePoint[],
): SpacePlane["definition"] {
  const kind = String(def.kind ?? "threePoints");
  switch (kind) {
    case "threePoints":
      return {
        kind: "threePoints",
        aId: resolvePointId(String(def.a ?? def.aId), figure, data, pendingPoints),
        bId: resolvePointId(String(def.b ?? def.bId), figure, data, pendingPoints),
        cId: resolvePointId(String(def.c ?? def.cId), figure, data, pendingPoints),
      };
    case "pointAndLine":
      return {
        kind: "pointAndLine",
        pointId: resolvePointId(String(def.point ?? def.pointId), figure, data, pendingPoints),
        lineId: resolveLineId(Number(def.lineIndex ?? def.lineId), lines),
      };
    case "twoLines":
      return {
        kind: "twoLines",
        lineAId: resolveLineId(Number(def.lineAIndex ?? def.lineAId), lines),
        lineBId: resolveLineId(Number(def.lineBIndex ?? def.lineBId), lines),
      };
    case "lineParallelToLine":
      return {
        kind: "lineParallelToLine",
        throughLineId: resolveLineId(Number(def.throughLineIndex ?? def.throughLineId), lines),
        parallelToLineId: resolveLineId(Number(def.parallelToLineIndex ?? def.parallelToLineId), lines),
      };
    default:
      throw new Error(`Неизвестный kind плоскости: ${kind}`);
  }
}

function applyColorGroup(
  style: Record<string, unknown> | undefined,
  index: number,
  defaultColor: string,
): { color: string; visible?: boolean; width?: number; visualKind?: string; helperOpacity?: number } {
  const src = style ?? {};
  const color = paletteColorFromGroup(src.colorGroup, index) ?? defaultColor;
  const out: Record<string, unknown> = { ...src, color };
  delete out.colorGroup;
  return out as { color: string };
}

export function expandAiSpaceScene(rawSpace3d: unknown): SpaceSceneData {
  const base = createSpaceSceneData();
  if (!rawSpace3d || typeof rawSpace3d !== "object" || Array.isArray(rawSpace3d)) {
    throw new Error("space3d должен быть объектом");
  }
  const input = rawSpace3d as Record<string, unknown>;
  const shapeKind = input.shapeKind as SpaceShapeKind | undefined;
  if (shapeKind !== "parallelepiped" && shapeKind !== "pyramid" && shapeKind !== "prism") {
    throw new Error('shapeKind должен быть "parallelepiped", "pyramid" или "prism"');
  }
  const baseVerticesInput = String(input.baseVerticesInput ?? "").trim();
  if (!baseVerticesInput) throw new Error("baseVerticesInput обязателен");

  const figureConstraints = figureConstraintsFromAi(shapeKind, input.figureConstraints);
  const { figure, error } = createFigureFromInput(shapeKind, baseVerticesInput, figureConstraints);
  if (!figure || error) {
    throw new Error(error ?? "Не удалось создать фигуру");
  }
  const body = figure;

  const viewRaw = (input.view ?? {}) as Record<string, unknown>;
  const yaw = typeof viewRaw.yaw === "number" && Number.isFinite(viewRaw.yaw) ? viewRaw.yaw : base.view.yaw;

  const data: SpaceSceneData = {
    ...base,
    shapeKind,
    baseVerticesInput,
    figureConstraints,
    figure: body,
    figureDirty: false,
    view: { ...base.view, yaw },
    points: [],
    lines: [],
    planes: [],
  };

  const pointsRaw = Array.isArray(input.points) ? input.points : [];
  const linesRaw = Array.isArray(input.lines) ? input.lines : [];
  const planesRaw = Array.isArray(input.planes) ? input.planes : [];

  const POINT_KINDS_BEFORE_LINES = new Set(["onLine", "onFace"]);
  const pendingPoints: SpacePoint[] = [];
  const earlyRows: Record<string, unknown>[] = [];
  const lateRows: Record<string, unknown>[] = [];
  for (const row of pointsRaw) {
    const def = (row as Record<string, unknown>).definition as LooseDef | undefined;
    const kind = String(def?.kind ?? "");
    if (POINT_KINDS_BEFORE_LINES.has(kind)) earlyRows.push(row as Record<string, unknown>);
    else lateRows.push(row as Record<string, unknown>);
  }

  function ingestPointRow(row: Record<string, unknown>, lines: SpaceLine[], planes: SpacePlane[]) {
    const index = Number(row.index ?? pendingPoints.length + 1);
    const label = String(row.label ?? `T${index}`);
    const def = mapPointDefinition(
      (row.definition ?? {}) as LooseDef,
      body,
      data,
      lines,
      planes,
      pendingPoints,
    );
    const pt = createSpacePoint(index, def, label);
    pt.built = row.built !== false;
    pt.dirty = pt.built;
    pt.style = { ...pt.style, ...applyColorGroup(row.style as Record<string, unknown>, index, pt.style.color) };
    pendingPoints.push(pt);
  }

  for (const row of earlyRows) ingestPointRow(row, [], []);
  data.points = pendingPoints;

  const lines: SpaceLine[] = [];
  for (let i = 0; i < linesRaw.length; i += 1) {
    const row = linesRaw[i] as Record<string, unknown>;
    const index = Number(row.index ?? i + 1);
    const def = mapLineDefinition(
      (row.definition ?? {}) as LooseDef,
      body,
      data,
      lines,
      data.planes,
      pendingPoints,
    );
    const line = createSpaceLine(index, def, String(row.label ?? ""));
    line.built = row.built !== false;
    line.dirty = line.built;
    const style = applyColorGroup(row.style as Record<string, unknown>, index, line.style.color);
    line.style = {
      ...line.style,
      ...style,
      visualKind: (style.visualKind as SpaceLine["style"]["visualKind"]) ?? line.style.visualKind,
      width: typeof style.width === "number" ? style.width : line.style.width,
    };
    lines.push(line);
  }
  data.lines = lines;

  const planes: SpacePlane[] = [];
  for (let i = 0; i < planesRaw.length; i += 1) {
    const row = planesRaw[i] as Record<string, unknown>;
    const index = Number(row.index ?? i + 1);
    const def = mapPlaneDefinition(
      (row.definition ?? {}) as LooseDef,
      body,
      data,
      lines,
      pendingPoints,
    );
    const plane = createSpacePlane(index, def, String(row.label ?? ""));
    plane.built = row.built !== false;
    plane.dirty = plane.built;
    plane.style = { ...plane.style, ...applyColorGroup(row.style as Record<string, unknown>, index, plane.style.color) };
    planes.push(plane);
  }
  data.planes = planes;

  for (const row of lateRows) ingestPointRow(row, lines, planes);
  data.points = pendingPoints;

  return data;
}
