/** Создание, значения по умолчанию и построение сцены. */
import { buildGraph, parseAnchors, piecewiseValuesAt, type PlotBounds } from "./build";
import { evaluateNumber, exactDisplay, makeMathValue } from "./math-expr";
import { resolveGeometry } from "./render";
import { intersectGraphs, pointsOnGraphAtX } from "./solve";
import type {
  AxisSpec,
  GraphKind,
  PlotAppearance,
  PlotScene,
  PointSolution,
  RenderCurve,
  RenderPoint,
  SceneGraph,
  ScenePoint,
} from "./types";

/** Стандартная палитра чертежей (номер colorGroup = позиция в списке). */
export const PLOT_PALETTE = [
  "#19ADFF",
  "#FFA84A",
  "#FF78F8",
  "#4A7BFF",
  "#FF8800",
  "#D438FF",
];

export const DEFAULT_APPEARANCE: PlotAppearance = {
  width: 720,
  height: 720,
  equalScale: false,
  padding: 16,

  axisWidth: 3,
  axisColor: "#1A2236",
  arrowSize: 24,
  gridWidth: 1,
  gridColor: "#CAD1E0",
  frame: true,
  frameWidth: 2,
  frameColor: "#CAD1E0",
  tickWidth: 2,
  tickSize: 6,

  labelFontFamily: "SB Sans Text, KaTeX_Main, system-ui, sans-serif",
  labelFontSize: 22,
  labelColor: "#1A2236",
  graphWidth: 3,
  pointRadius: 6,
  pointLabelFontSize: 32,
  pointLabelFontFamily: "SB Sans Text, KaTeX_Main, system-ui, sans-serif",
  projectionWidth: 1.2,
  projectionColor: "#8A93A6",
};

function createAxis(name: string): AxisSpec {
  return {
    name,
    unit: "",
    min: "",
    max: "",
    mode: "full",
    stepAuto: true,
    step: "",
    labelFormat: "number",
    markRule: "all",
    selectedMarks: "",
  };
}

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function createScene(): PlotScene {
  return {
    version: 1,
    space: "plane",
    xAxis: { ...createAxis("x"), min: "-5", max: "5" },
    yAxis: { ...createAxis("y"), min: "-5", max: "5" },
    grid: { visible: true, followAxisStep: true, stepX: "", stepY: "" },
    appearance: { ...DEFAULT_APPEARANCE },
    graphs: [],
    points: [],
    tangents: [],
    customColors: [],
  };
}

export function createGraph(index: number, kind: GraphKind = "explicit"): SceneGraph {
  return {
    id: nextId("graph"),
    index,
    math: {
      kind,
      expression: "",
      equation: "",
      pieces: [{ expression: "", from: "", to: "", includeFrom: true, includeTo: false }],
      anchors: [
        { x: "", y: "", kind: "plain" },
        { x: "", y: "", kind: "plain" },
      ],
      extendEnds: true,
      domainFrom: "",
      domainTo: "",
    },
    style: {
      color: PLOT_PALETTE[(index - 1) % PLOT_PALETTE.length],
      width: null,
      label: "",
      visible: true,
    },
    built: null,
    dirty: true,
    error: null,
  };
}

export function createPoint(index: number): ScenePoint {
  return {
    id: nextId("point"),
    index,
    math: { mode: "plane", x: "", y: "", graphId: null, graphIdB: null, anchorIndex: null },
    style: {
      color: PLOT_PALETTE[0],
      open: false,
      label: "",
      showCoords: false,
      visible: true,
      projectX: false,
      projectY: false,
      labelProjectionX: false,
      labelProjectionY: false,
    },
    built: null,
    dirty: true,
    error: null,
  };
}

/** Короткое описание функции для свёрнутой карточки. */
export function graphSummary(graph: SceneGraph, yName: string): string {
  const math = graph.math;
  switch (math.kind) {
    case "explicit":
      return math.expression.trim() ? `${yName} = ${math.expression.trim()}` : "явная функция";
    case "implicit":
      return math.equation.trim() || "неявное уравнение";
    case "piecewise":
      return `кусочная функция, участков: ${math.pieces.length}`;
    case "qualitative":
      return `по ${math.anchors.length} опорным точкам`;
    default:
      return "функция";
  }
}

export function sceneBounds(scene: PlotScene): PlotBounds | null {
  const geometry = resolveGeometry(scene);
  if (!geometry) return null;
  const { xMin, xMax, yMin, yMax } = geometry;
  return { xMin, xMax, yMin, yMax };
}

function valueDisplay(raw: string, value: number): string {
  const text = String(raw ?? "").trim();
  if (!text) return exactDisplay(value);
  try {
    return makeMathValue(text).display;
  } catch {
    return exactDisplay(value);
  }
}

/** Построение одной точки. Бросает ошибку с понятным текстом. */
export function buildPoint(point: ScenePoint, scene: PlotScene, bounds: PlotBounds): PointSolution[] {
  const previous = point.built ?? [];
  const keepShow = (index: number) => previous[index]?.show ?? true;
  const keepStyle = (index: number) => previous[index]?.style;
  const inside = (x: number, y: number) =>
    x >= bounds.xMin - 1e-9 && x <= bounds.xMax + 1e-9 && y >= bounds.yMin - 1e-9 && y <= bounds.yMax + 1e-9;

  if (point.math.mode === "plane") {
    if (!point.math.x.trim() || !point.math.y.trim()) throw new Error("Заполните обе координаты.");
    const x = evaluateNumber(point.math.x);
    const y = evaluateNumber(point.math.y);
    return [
      {
        x,
        y,
        displayX: valueDisplay(point.math.x, x),
        displayY: valueDisplay(point.math.y, y),
        show: keepShow(0),
        style: keepStyle(0),
      },
    ];
  }

  if (point.math.mode === "onGraph") {
    const graph = scene.graphs.find((item) => item.id === point.math.graphId);
    if (!graph) throw new Error("Не выбран график.");
    if (!graph.built) throw new Error(`Функция ${graph.index} ещё не построена.`);
    if (graph.math.kind === "qualitative" && point.math.anchorIndex !== null) {
      const anchors = parseAnchors(graph.math);
      const anchor = anchors[point.math.anchorIndex];
      if (!anchor) throw new Error("Опорная точка не найдена.");
      return [
        {
          x: anchor.x,
          y: anchor.y,
          displayX: exactDisplay(anchor.x),
          displayY: exactDisplay(anchor.y),
          show: keepShow(0),
          style: keepStyle(0),
        },
      ];
    }
    if (!point.math.x.trim()) throw new Error("Введите координату по горизонтальной оси.");
    const x = evaluateNumber(point.math.x);
    if (graph.math.kind === "piecewise") {
      const vars = { x: scene.xAxis.name.trim() || "x" };
      const y = piecewiseValueAt(graph.math, vars, x);
      return [
        {
          x,
          y,
          displayX: valueDisplay(point.math.x, x),
          displayY: exactDisplay(y),
          show: keepShow(0),
          style: keepStyle(0),
        },
      ];
    }
    const found = pointsOnGraphAtX(graph.built, x);
    if (!found.length) throw new Error("В этой координате график не определён.");

    return found.map((item, index) => ({
      x: item.x,
      y: item.y,
      displayX: valueDisplay(point.math.x, item.x),
      displayY: exactDisplay(item.y),
      show: keepShow(index),
      style: keepStyle(index),
    }));
  }

  const first = scene.graphs.find((item) => item.id === point.math.graphId);
  const second = scene.graphs.find((item) => item.id === point.math.graphIdB);
  if (!first || !second) throw new Error("Выберите два графика.");
  if (first.id === second.id) throw new Error("Выберите два разных графика.");
  if (!first.built || !second.built) throw new Error("Оба графика должны быть построены.");
  const hits = intersectGraphs(first.built, second.built).filter((hit) => inside(hit.x, hit.y));
  if (!hits.length) throw new Error("Пересечений в текущей области не найдено.");
  return hits.map((hit, index) => ({
    x: hit.x,
    y: hit.y,
    displayX: exactDisplay(hit.x),
    displayY: exactDisplay(hit.y),
    show: keepShow(index),
    style: keepStyle(index),
  }));
}

export interface BuildReport {
  scene: PlotScene;
  built: number;
  errors: string[];
}

/** Построение всей сцены: одна ошибка не уничтожает успешные объекты. */
export function buildScene(scene: PlotScene, only?: { graphId?: string; pointId?: string }): BuildReport {
  const bounds = sceneBounds(scene);
  const errors: string[] = [];
  let built = 0;
  if (!bounds) {
    return { scene, built: 0, errors: ["Заполните пределы обеих осей."] };
  }
  const vars = { x: scene.xAxis.name.trim() || "x", y: scene.yAxis.name.trim() || "y" };

  const graphs = scene.graphs.map((graph) => {
    if (only?.graphId && graph.id !== only.graphId) return graph;
    if (only?.pointId) return graph;
    try {
      const result = buildGraph(graph.math, vars, bounds);
      built += 1;
      return { ...graph, built: result, dirty: false, error: null };
    } catch (error) {
      const message = (error as Error).message;
      errors.push(`Функция ${graph.index} не построена: ${message}`);
      return { ...graph, error: message };
    }
  });

  const withGraphs: PlotScene = { ...scene, graphs };
  const points = scene.points.map((point) => {
    if (only?.graphId) return point;
    if (only?.pointId && point.id !== only.pointId) return point;
    try {
      const solutions = buildPoint(point, withGraphs, bounds);
      built += 1;
      return { ...point, built: solutions, dirty: false, error: null };
    } catch (error) {
      const message = (error as Error).message;
      errors.push(`Точка ${point.index} не построена: ${message}`);
      return { ...point, error: message };
    }
  });

  return { scene: { ...withGraphs, points }, built, errors };
}

/** Данные для рисовальщика: только построенные и видимые объекты. */
export function sceneCurves(scene: PlotScene): RenderCurve[] {
  return scene.graphs
    .filter((graph) => graph.built && graph.style.visible)
    .map((graph) => ({
      color: graph.style.color,
      width: graph.style.width ?? scene.appearance.graphWidth,
      segments: graph.built!.segments,
    }));
}

export function scenePoints(scene: PlotScene): RenderPoint[] {
  const result: RenderPoint[] = [];
  for (const point of scene.points) {
    if (!point.built || !point.style.visible) continue;
    for (const solution of point.built) {
      if (!solution.show) continue;
      // Индивидуальные настройки решения перекрывают общие настройки точки.
      const style = { ...point.style, ...(solution.style ?? {}) };
      if (!style.visible) continue;
      result.push({
        x: solution.x,
        y: solution.y,
        color: style.color,
        open: style.open,
        label: (style.label ?? "").trim(),
        coords: style.showCoords ? `(${solution.displayX}; ${solution.displayY})` : null,
        projectX: style.projectX,
        projectY: style.projectY,
        labelProjectionX: style.labelProjectionX ? solution.displayX : null,
        labelProjectionY: style.labelProjectionY ? solution.displayY : null,
      });
    }
  }
  return result;
}
