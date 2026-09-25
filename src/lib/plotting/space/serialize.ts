/**
 * Сохранение/загрузка пространственной сцены: только пользовательские параметры,
 * без топологии тела, координат вершин и вычисленных полей fit/geometry.
 */
import type { PlotScene } from "../types";
import {
  createFigureFromInput,
  createSpaceLine,
  createSpacePlane,
  createSpacePoint,
  createSpaceSceneData,
  defaultParallelepipedConstraints,
  defaultPyramidConstraints,
  defaultPrismConstraints,
  figureVertexInputString,
} from "./scene";
import type {
  ParallelepipedConstraints,
  PrismConstraints,
  PyramidConstraints,
  SpaceAppearance,
  SpaceFigureConstraints,
  SpaceLine,
  SpaceLineDefinition,
  SpaceLineStyle,
  SpacePlane,
  SpacePlaneDefinition,
  SpacePlaneStyle,
  SpacePoint,
  SpacePointDefinition,
  SpacePointStyle,
  SpaceSceneData,
  SpaceShapeKind,
  SpaceViewParams,
} from "./types";

/** Фрагмент JSON сцены «Пространство» (без figure и без runtime-полей). */
export interface SpaceSceneDataJson {
  shapeKind: SpaceShapeKind | null;
  baseVerticesInput: string;
  figureConstraints: SpaceFigureConstraints;
  /** На момент выгрузки фигура была построена на canvas. */
  figureBuilt: boolean;
  points: Array<{
    id: string;
    index: number;
    label: string;
    definition: SpacePointDefinition;
    style: SpacePointStyle;
    built: boolean;
  }>;
  lines: Array<{
    id: string;
    index: number;
    label: string;
    definition: SpaceLineDefinition;
    style: SpaceLineStyle;
    built: boolean;
  }>;
  planes: Array<{
    id: string;
    index: number;
    label: string;
    definition: SpacePlaneDefinition;
    style: SpacePlaneStyle;
    built: boolean;
  }>;
  view: SpaceViewParamsJson;
  appearance: SpaceAppearance;
}

/** Параметры вида без авто-fit и устаревших полей, выводимых из constraints. */
export type SpaceViewParamsJson = Pick<
  SpaceViewParams,
  | "scale"
  | "yaw"
  | "pitch"
  | "depthLength"
  | "heightLength"
  | "scaleX"
  | "scaleY"
  | "visibilityMode"
  | "planeFillByDepth"
  | "showPlaneIntersections"
  | "planeFillDepthMode"
  | "showRotationEllipse"
  | "showViewConvergenceRays"
  | "pointLabelsUseEdgeColor"
  | "renderGrayscale"
>;

function stripViewForExport(view: SpaceViewParams): SpaceViewParamsJson {
  return {
    scale: view.scale,
    yaw: view.yaw,
    pitch: view.pitch ?? 0,
    depthLength: view.depthLength,
    heightLength: view.heightLength,
    scaleX: view.scaleX,
    scaleY: view.scaleY,
    visibilityMode: view.visibilityMode,
    planeFillByDepth: view.planeFillByDepth,
    showPlaneIntersections: view.showPlaneIntersections,
    planeFillDepthMode: view.planeFillDepthMode,
    showRotationEllipse: view.showRotationEllipse,
    showViewConvergenceRays: view.showViewConvergenceRays,
    pointLabelsUseEdgeColor: view.pointLabelsUseEdgeColor,
    renderGrayscale: view.renderGrayscale,
  };
}

function mergeViewFromJson(partial: Partial<SpaceViewParamsJson>, base: SpaceViewParams): SpaceViewParams {
  return {
    ...base,
    ...partial,
    fitScale: undefined,
    fitCx: undefined,
    fitCy: undefined,
  };
}

function normalizeConstraints(
  shapeKind: SpaceShapeKind | null,
  raw: unknown,
): SpaceFigureConstraints {
  const o = (raw ?? {}) as Partial<SpaceFigureConstraints>;
  if (shapeKind === "pyramid") {
    const d = defaultPyramidConstraints();
    const p = o as Partial<PyramidConstraints>;
    return {
      apexOnCenter: p.apexOnCenter ?? d.apexOnCenter,
      equilateral: p.equilateral ?? d.equilateral,
      badAngleDeg: p.badAngleDeg ?? d.badAngleDeg,
    };
  }
  if (shapeKind === "prism") {
    const d = defaultPrismConstraints();
    const p = o as Partial<PrismConstraints>;
    return {
      straight: p.straight ?? d.straight,
      equilateral: p.equilateral ?? d.equilateral,
      badAngleDeg: p.badAngleDeg ?? d.badAngleDeg,
    };
  }
  const d = defaultParallelepipedConstraints();
  const pp = o as Partial<ParallelepipedConstraints>;
  return {
    rectangular: pp.rectangular ?? d.rectangular,
    equilateral: pp.equilateral ?? d.equilateral,
    badAngleDeg: pp.badAngleDeg ?? d.badAngleDeg,
  };
}

function resolveShapeKind(raw: Record<string, unknown>): SpaceShapeKind | null {
  const k = raw.shapeKind;
  if (k === "parallelepiped" || k === "pyramid" || k === "prism") return k;
  const fig = raw.figure as { kind?: string } | null | undefined;
  if (fig?.kind === "parallelepiped" || fig?.kind === "pyramid" || fig?.kind === "prism") return fig.kind;
  return null;
}

function resolveBaseVerticesInput(raw: Record<string, unknown>, shapeKind: SpaceShapeKind | null): string {
  const text = String(raw.baseVerticesInput ?? "").trim();
  if (text) return text;
  const fig = raw.figure as SpaceSceneData["figure"];
  if (!fig) return "";
  try {
    return figureVertexInputString(fig);
  } catch {
    return "";
  }
}

function figureWasBuilt(raw: Record<string, unknown>): boolean {
  if (typeof raw.figureBuilt === "boolean") return raw.figureBuilt;
  return raw.figure != null;
}

/** Выгрузка: семантика построения, без figure и без geometry/built/errors. */
export function serializeSpaceSceneData(data: SpaceSceneData): SpaceSceneDataJson {
  const baseVerticesInput =
    data.baseVerticesInput.trim() ||
    (data.figure ? figureVertexInputString(data.figure) : "");

  return {
    shapeKind: data.shapeKind,
    baseVerticesInput,
    figureConstraints: { ...data.figureConstraints },
    figureBuilt: data.figure != null,
    points: data.points.map((p) => ({
      id: p.id,
      index: p.index,
      label: p.label,
      definition: p.definition,
      style: { ...p.style },
      built: p.built,
    })),
    lines: data.lines.map((l) => ({
      id: l.id,
      index: l.index,
      label: l.label,
      definition: l.definition,
      style: { ...l.style },
      built: l.built,
    })),
    planes: data.planes.map((pl) => ({
      id: pl.id,
      index: pl.index,
      label: pl.label,
      definition: pl.definition,
      style: { ...pl.style },
      built: pl.built,
    })),
    view: stripViewForExport(data.view),
    appearance: { ...data.appearance },
  };
}

function restoreSpacePoint(raw: SpaceSceneDataJson["points"][number]): SpacePoint {
  const base = createSpacePoint(raw.index, raw.definition, raw.label);
  return {
    ...base,
    id: raw.id,
    index: raw.index,
    label: raw.label,
    definition: raw.definition,
    style: { ...base.style, ...raw.style },
    built: raw.built,
    geometry: null,
    lastBuilt: null,
    dirty: raw.built,
    error: null,
  };
}

function restoreSpaceLine(raw: SpaceSceneDataJson["lines"][number]): SpaceLine {
  const base = createSpaceLine(raw.index, raw.definition, raw.label);
  return {
    ...base,
    id: raw.id,
    index: raw.index,
    label: raw.label,
    definition: raw.definition,
    style: { ...base.style, ...raw.style },
    built: raw.built,
    dirty: raw.built,
    error: null,
    lastOk: false,
  };
}

function restoreSpacePlane(raw: SpaceSceneDataJson["planes"][number]): SpacePlane {
  const base = createSpacePlane(raw.index, raw.definition, raw.label);
  return {
    ...base,
    id: raw.id,
    index: raw.index,
    label: raw.label,
    definition: raw.definition,
    style: { ...base.style, ...raw.style },
    built: raw.built,
    dirty: raw.built,
    error: null,
    lastOk: false,
  };
}

/** Загрузка: восстанавливает figure из ввода и constraints, затем объекты по id. */
export function deserializeSpaceSceneData(raw: unknown): SpaceSceneData {
  const base = createSpaceSceneData();
  if (!raw || typeof raw !== "object") return base;

  const o = raw as Record<string, unknown>;
  const shapeKind = resolveShapeKind(o);
  const figureConstraints = normalizeConstraints(shapeKind, o.figureConstraints ?? (o.figure as { constraints?: unknown })?.constraints);
  const baseVerticesInput = resolveBaseVerticesInput(o, shapeKind);
  const wantFigure = figureWasBuilt(o);

  let figure = null as SpaceSceneData["figure"];
  let figureDirty = false;
  if (wantFigure && shapeKind && baseVerticesInput) {
    const created = createFigureFromInput(shapeKind, baseVerticesInput, figureConstraints);
    if (created.figure) {
      figure = created.figure;
      figureDirty = false;
    } else {
      figureDirty = true;
    }
  } else if (wantFigure) {
    figureDirty = true;
  }

  const pointsRaw = Array.isArray(o.points) ? o.points : [];
  const linesRaw = Array.isArray(o.lines) ? o.lines : [];
  const planesRaw = Array.isArray(o.planes) ? o.planes : [];

  const viewRaw = (o.view ?? {}) as Partial<SpaceViewParamsJson>;
  const appearanceRaw = (o.appearance ?? {}) as Partial<SpaceAppearance>;

  return {
    shapeKind,
    baseVerticesInput,
    figureConstraints,
    figureDirty,
    figure,
    points: pointsRaw.map((p) => restoreSpacePoint(p as SpaceSceneDataJson["points"][number])),
    lines: linesRaw.map((l) => restoreSpaceLine(l as SpaceSceneDataJson["lines"][number])),
    planes: planesRaw.map((pl) => restoreSpacePlane(pl as SpaceSceneDataJson["planes"][number])),
    view: mergeViewFromJson(viewRaw, base.view),
    appearance: { ...base.appearance, ...appearanceRaw },
  };
}

/**
 * Полная сцена plotting для JSON.
 * Поле `space`: `"line"` | `"plane"` | `"space"` — куда открывать вкладку при загрузке.
 */
export function serializePlotSceneForExport(scene: PlotScene): PlotScene {
  if (scene.space === "line" && scene.line) {
    return {
      ...scene,
      version: 1,
      space: "line",
      graphs: [],
      points: [],
      tangents: scene.tangents ?? [],
      space3d: null,
    };
  }

  if (scene.space === "space" && scene.space3d) {
    return {
      version: 1,
      space: "space",
      axisScaleMode: scene.axisScaleMode,
      plotAspectRatio: scene.plotAspectRatio,
      xAxis: scene.xAxis,
      yAxis: scene.yAxis,
      grid: scene.grid,
      appearance: scene.appearance,
      graphs: [],
      points: [],
      tangents: [],
      customColors: scene.customColors,
      line: null,
      space3d: serializeSpaceSceneData(scene.space3d) as unknown as SpaceSceneData,
    };
  }

  return {
    ...scene,
    version: 1,
    space: scene.space ?? "plane",
    line: null,
    space3d: null,
  };
}

/** Импорт space3d из JSON (новый или legacy с полным figure). */
export function importSpaceSceneFromJson(raw: unknown): SpaceSceneData {
  return deserializeSpaceSceneData(raw);
}
