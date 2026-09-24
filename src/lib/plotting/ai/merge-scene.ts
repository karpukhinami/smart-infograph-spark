/** Слияние JSON от модели с дефолтами сцены (только ИИ-путь). */
import {
  createGraph,
  createPoint,
  createScene,
  migrateAxisImport,
} from "../scene";
import { createLineScene, createSet, createLinePoint } from "../line/scene";
import { filterAiLinePoints, normalizeLineAxisRows } from "../line/import-ai";
import {
  normalizeAiGraphStyle,
  normalizeAiLinePointStyle,
  normalizeAiPointStyle,
  normalizeAiSetStyle,
  stripAiSceneMeta,
} from "./sanitize-input";
import { expandAiSpaceScene } from "../space/import-ai-space";
import { createSpacePlotScene } from "../scene";
import type { AxisSpec, GridSpec, PlotScene } from "../types";

export function mergeAiScene(raw: unknown): PlotScene {
  const cleaned = stripAiSceneMeta(raw);
  const input = (cleaned ?? {}) as Partial<PlotScene> & {
    grid?: Partial<GridSpec> & { followAxisStep?: boolean; stepX?: string; stepY?: string };
    space3d?: unknown;
  };

  if (input.space === "space" || (input.space3d != null && typeof input.space3d === "object")) {
    const spaceDefaults = createSpacePlotScene();
    const space3d = expandAiSpaceScene(input.space3d ?? {});
    return {
      ...spaceDefaults,
      version: 1,
      space: "space",
      appearance: spaceDefaults.appearance,
      graphs: [],
      points: [],
      tangents: [],
      customColors: [],
      line: null,
      space3d,
    };
  }

  const base = createScene();
  const legacyGrid: Partial<GridSpec> & { followAxisStep?: boolean; stepX?: string; stepY?: string } =
    input.grid ?? {};
  const isLine = input.space === "line";

  if (isLine) {
    const lineBase = createLineScene();
    const rawLine = normalizeLineAxisRows({
      ...(input.line ?? {}),
      axisRowCount: input.line?.axisRowCount ?? lineBase.line!.axisRowCount,
      sets: input.line?.sets ?? [],
      points: filterAiLinePoints(input.line?.points),
    });
    return {
      ...lineBase,
      ...input,
      appearance: lineBase.appearance,
      customColors: [],
      line: {
        ...lineBase.line!,
        ...rawLine,
        ticks: { ...lineBase.line!.ticks, ...(rawLine.ticks ?? {}) },
        sets: (rawLine.sets ?? []).map((set, position) => {
          const index = set.index ?? position + 1;
          const defaults = createSet(index, set.axisRow ?? 0);
          return {
            ...defaults,
            ...set,
            index,
            math: { ...defaults.math, ...set.math },
            style: normalizeAiSetStyle(set.style as unknown as Record<string, unknown>, defaults.style, index),
            built: null,
            dirty: true,
            error: null,
          };
        }),
        points: (rawLine.points ?? []).map((point, position) => {
          const index = point.index ?? position + 1;
          const defaults = createLinePoint(index, point.axisRow ?? 0);
          return {
            ...defaults,
            ...point,
            index,
            math: { ...defaults.math, ...point.math },
            style: normalizeAiLinePointStyle(
              point.style as unknown as Record<string, unknown>,
              defaults.style,
              index,
            ),
            built: null,
            dirty: true,
            error: null,
          };
        }),
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
    appearance: base.appearance,
    customColors: [],
    graphs: (input.graphs ?? []).map((graph, position) => {
      const index = graph.index ?? position + 1;
      const defaults = createGraph(index);
      return {
        ...defaults,
        ...graph,
        index,
        math: { ...defaults.math, ...graph.math },
        style: normalizeAiGraphStyle(graph.style as unknown as Record<string, unknown>, defaults.style, index),
        built: null,
        dirty: true,
        error: null,
      };
    }),
    points: (input.points ?? []).map((point, position) => {
      const index = point.index ?? position + 1;
      const defaults = createPoint(index);
      return {
        ...defaults,
        ...point,
        index,
        math: { ...defaults.math, ...point.math },
        style: {
          ...defaults.style,
          ...normalizeAiPointStyle(point.style as unknown as Record<string, unknown>, defaults.style, index),
        },
        built: null,
        dirty: true,
        error: null,
      };
    }),
    tangents: input.tangents ?? [],
    line: null,
    version: 1,
    space: "plane",
  };
}
