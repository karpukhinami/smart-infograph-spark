/** Слияние JSON от модели с дефолтами сцены (как importScene в store). */
import {
  createGraph,
  createPoint,
  createScene,
  migrateAxisImport,
} from "../scene";
import { createLineScene } from "../line/scene";
import type { AxisSpec, GridSpec, PlotScene } from "../types";

export function mergeAiScene(raw: unknown): PlotScene {
  const base = createScene();
  const input = (raw ?? {}) as Partial<PlotScene> & {
    grid?: Partial<GridSpec> & { followAxisStep?: boolean; stepX?: string; stepY?: string };
  };
  const legacyGrid = input.grid ?? {};
  const isLine = input.space === "line";

  if (isLine) {
    const lineBase = createLineScene();
    return {
      ...lineBase,
      ...input,
      appearance: { ...lineBase.appearance, ...(input.appearance ?? {}) },
      line: {
        ...lineBase.line!,
        ...(input.line ?? {}),
        sets: input.line?.sets ?? [],
        points: input.line?.points ?? [],
      },
      version: 1,
      space: "line",
    };
  }

  return {
    ...base,
    ...input,
    axisScaleMode: input.axisScaleMode ?? base.axisScaleMode,
    plotAspectRatio: input.plotAspectRatio ?? base.plotAspectRatio,
    xAxis: migrateAxisImport(base.xAxis, (input.xAxis ?? {}) as Partial<AxisSpec>, legacyGrid.stepX ?? ""),
    yAxis: migrateAxisImport(base.yAxis, (input.yAxis ?? {}) as Partial<AxisSpec>, legacyGrid.stepY ?? ""),
    grid: { visible: legacyGrid.visible ?? base.grid.visible },
    appearance: { ...base.appearance, ...(input.appearance ?? {}) },
    graphs: (input.graphs ?? []).map((graph, position) => ({
      ...createGraph(position + 1),
      ...graph,
      math: { ...createGraph(position + 1).math, ...graph.math },
      style: { ...createGraph(position + 1).style, ...graph.style },
      built: null,
      dirty: true,
      error: null,
    })),
    points: (input.points ?? []).map((point, position) => ({
      ...createPoint(position + 1),
      ...point,
      math: { ...createPoint(position + 1).math, ...point.math },
      style: { ...createPoint(position + 1).style, ...point.style },
      built: null,
      dirty: true,
      error: null,
    })),
    tangents: input.tangents ?? [],
    customColors: input.customColors ?? [],
    line: null,
    version: 1,
    space: "plane",
  };
}
