/** Состояние страницы plotting. UI меняет только сцену; сцена — единый контракт. */
import { create } from "zustand";
import {
  EMPTY_POINT_MATH,
  buildScene,
  createGraph,
  createPoint,
  createScene,
  migrateAxisImport,
  solvePointMath,
} from "./scene";
import { evaluateNumber } from "./math-expr";
import { niceStep } from "./ticks";
import type {
  AxisScaleMode,
  AxisSpec,
  GraphMath,
  GraphStyle,
  GridSpec,
  PlotAppearance,
  PlotAspectRatio,
  PlotScene,
  PointMath,
  PointStyle,
  SceneGraph,
  ScenePoint,
} from "./types";
import {
  buildLineScene,
  buildSetMath,
  buildLinePoint,
  createLinePoint,
  createLineScene,
  createSet,
  removeSetFromLine,
  syncSetFromBoundaryPoint,
} from "./line/scene";
import { filterAiLinePoints, normalizeLineAxisRows } from "./line/import-ai";
import { mergeAiScene } from "./ai/merge-scene";
import type {
  LineAxisSpec,
  LinePointStyle,
  LineSceneData,
  LineTickSettings,
  SceneLinePoint,
  SceneSet,
  SetMath,
  SetStyle,
} from "./line/types";

export type PlotInputMode = "manual" | "ai";
export type PlotSpaceTab = "line" | "plane" | "space";

export interface BuildStatus {
  built: number;
  errors: string[];
  at: number;
}

interface PlotStore {
  scene: PlotScene;
  inputMode: PlotInputMode;
  spaceTab: PlotSpaceTab;
  status: BuildStatus | null;
  /** Черновик добавляемой точки: живёт вне сцены до нажатия «Отметить». */
  pointDraft: PointMath | null;
  pointDraftError: string | null;
  /** Черновик множества на прямой. */
  setDraft: SceneSet | null;
  setDraftError: string | null;
  /** Черновик самостоятельной точки на прямой. */
  linePointDraft: SceneLinePoint | null;
  linePointDraftError: string | null;
  /** Текущий активный ряд оси для новых объектов. */
  activeAxisRow: number;
  setInputMode: (mode: PlotInputMode) => void;
  setSpaceTab: (tab: PlotSpaceTab) => void;
  updateLineAxis: (patch: Partial<LineAxisSpec>) => void;
  updateLineTicks: (patch: Partial<LineTickSettings>) => void;
  startSetDraft: (createNewAxis?: boolean) => void;
  updateSetDraft: (patch: Partial<SceneSet>) => void;
  updateSetDraftMath: (patch: Partial<SetMath>) => void;
  cancelSetDraft: () => void;
  commitSetDraft: () => void;
  updateSetMath: (id: string, patch: Partial<SetMath>) => void;
  updateSetStyle: (id: string, patch: Partial<SetStyle>) => void;
  buildSet: (id: string) => void;
  removeSet: (id: string) => void;
  startLinePointDraft: () => void;
  updateLinePointDraft: (patch: Partial<SceneLinePoint>) => void;
  updateLinePointDraftMath: (patch: Partial<SceneLinePoint["math"]>) => void;
  updateLinePointDraftStyle: (patch: Partial<LinePointStyle>) => void;
  cancelLinePointDraft: () => void;
  commitLinePointDraft: () => void;
  updateLinePointMath: (id: string, patch: Partial<SceneLinePoint["math"]>) => void;
  updateLinePointStyle: (id: string, patch: Partial<LinePointStyle>) => void;
  buildLinePointItem: (id: string) => void;
  removeLinePoint: (id: string) => void;
  updateAxis: (axis: "xAxis" | "yAxis", patch: Partial<AxisSpec>) => void;
  updateAxisScale: (patch: { axisScaleMode?: AxisScaleMode; plotAspectRatio?: PlotAspectRatio }) => void;
  updateGrid: (patch: Partial<GridSpec>) => void;
  updateAppearance: (patch: Partial<PlotAppearance>) => void;
  resetAppearance: () => void;
  addGraph: () => void;
  updateGraphMath: (id: string, patch: Partial<GraphMath>) => void;
  updateGraphStyle: (id: string, patch: Partial<GraphStyle>) => void;
  removeGraph: (id: string) => void;
  startPointDraft: () => void;
  updatePointDraft: (patch: Partial<PointMath>) => void;
  cancelPointDraft: () => void;
  commitPointDraft: () => void;
  updatePointMath: (id: string, patch: Partial<PointMath>) => void;
  updatePointStyle: (id: string, patch: Partial<PointStyle>) => void;
  togglePointSolution: (id: string, index: number, show: boolean) => void;
  updateSolutionStyle: (id: string, index: number, patch: Partial<PointStyle>) => void;
  removePoint: (id: string) => void;
  addCustomColor: (color: string) => void;
  buildGraph: (id: string) => void;
  buildPoint: (id: string) => void;
  buildAll: () => void;
  importScene: (raw: unknown) => void;
  importAiScene: (raw: unknown) => void;
  resetScene: () => void;
}


function reindex<T extends { index: number }>(items: T[]): T[] {
  return items.map((item, position) => ({ ...item, index: position + 1 }));
}

function axisBounds(min: string, max: string): { min: number; max: number } | null {
  try {
    const lo = evaluateNumber(min);
    const hi = evaluateNumber(max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) return null;
    return { min: lo, max: hi };
  } catch {
    return null;
  }
}

function autoGridStepForAxis(axis: AxisSpec): string {
  const bounds = axisBounds(axis.min, axis.max);
  return bounds ? String(niceStep(bounds.min, bounds.max)) : axis.gridStep;
}

function commitImportedScene(
  set: (partial: Partial<PlotStore> | ((state: PlotStore) => Partial<PlotStore>)) => void,
  scene: PlotScene,
): void {
  if (scene.space === "line" && scene.line) {
    const report = buildLineScene(scene.line);
    set({
      scene: { ...scene, line: report.line },
      spaceTab: "line",
      status: { built: report.built, errors: report.errors, at: Date.now() },
      pointDraft: null,
      pointDraftError: null,
      setDraft: null,
      setDraftError: null,
      linePointDraft: null,
      linePointDraftError: null,
    });
    return;
  }
  const report = buildScene(scene);
  set({
    scene: report.scene,
    status: { built: report.built, errors: report.errors, at: Date.now() },
    pointDraft: null,
    pointDraftError: null,
  });
}

export const usePlotStore = create<PlotStore>((set, get) => ({
  scene: createScene(),
  inputMode: "manual",
  spaceTab: "plane",
  status: null,
  pointDraft: null,
  pointDraftError: null,
  setDraft: null,
  setDraftError: null,
  linePointDraft: null,
  linePointDraftError: null,
  activeAxisRow: 0,

  startPointDraft: () => set({ pointDraft: { ...EMPTY_POINT_MATH }, pointDraftError: null }),

  updatePointDraft: (patch) =>
    set((state) => ({
      pointDraft: state.pointDraft ? { ...state.pointDraft, ...patch } : state.pointDraft,
      pointDraftError: null,
    })),

  cancelPointDraft: () => set({ pointDraft: null, pointDraftError: null }),

  commitPointDraft: () => {
    const state = get();
    const draft = state.pointDraft;
    if (!draft) return;
    try {
      const solutions = solvePointMath(state.scene, draft);
      // Цвет по умолчанию: точка на графике (в т.ч. из опорных точек) берёт цвет
      // своего графика, точка на пересечении — цвет первого выбранного графика.
      const sourceGraphId =
        draft.mode === "onGraph" || draft.mode === "anchor" || draft.mode === "intersection"
          ? draft.graphId
          : null;
      const sourceColor = sourceGraphId
        ? state.scene.graphs.find((graph) => graph.id === sourceGraphId)?.style.color
        : undefined;
      // Каждое найденное решение становится отдельной плашкой точки.
      const created = solutions.map((solution, position) =>
        ({
          ...createPoint(state.scene.points.length + position + 1, draft, {
            open: Boolean(solution.style?.open),
            ...(sourceColor ? { color: sourceColor } : {}),
          }),
          built: [{ ...solution, show: true, style: undefined }],
          dirty: false,
          error: null,
        }) as ScenePoint,
      );

      set({
        scene: { ...state.scene, points: [...state.scene.points, ...created] },
        pointDraft: null,
        pointDraftError: null,
      });
    } catch (error) {
      set({ pointDraftError: (error as Error).message });
    }
  },


  setInputMode: (inputMode) => set({ inputMode }),

  setSpaceTab: (spaceTab) =>
    set((state) => {
      if (spaceTab === state.spaceTab) return state;
      if (spaceTab === "line") {
        return {
          spaceTab,
          scene: createLineScene(),
          status: null,
          pointDraft: null,
          pointDraftError: null,
          setDraft: null,
          setDraftError: null,
          linePointDraft: null,
          linePointDraftError: null,
          activeAxisRow: 0,
        };
      }
      if (spaceTab === "plane") {
        return {
          spaceTab,
          scene: createScene(),
          status: null,
          pointDraft: null,
          pointDraftError: null,
          setDraft: null,
          setDraftError: null,
          linePointDraft: null,
          linePointDraftError: null,
          activeAxisRow: 0,
        };
      }
      return { spaceTab };
    }),

  updateLineAxis: (patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      return {
        scene: {
          ...state.scene,
          line: { ...state.scene.line, axis: { ...state.scene.line.axis, ...patch } },
        },
      };
    }),

  updateLineTicks: (patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      return {
        scene: {
          ...state.scene,
          line: { ...state.scene.line, ticks: { ...state.scene.line.ticks, ...patch } },
        },
      };
    }),

  startSetDraft: (createNewAxis = false) => {
    const state = get();
    const line = state.scene.line;
    if (!line) return;
    let axisRow = state.activeAxisRow;
    if (createNewAxis) {
      axisRow = line.axisRowCount;
    }
    const draft = createSet(line.sets.length + 1, axisRow);
    set({ setDraft: draft, setDraftError: null });
  },

  updateSetDraft: (patch) =>
    set((state) =>
      state.setDraft ? { setDraft: { ...state.setDraft, ...patch }, setDraftError: null } : state,
    ),

  updateSetDraftMath: (patch) =>
    set((state) =>
      state.setDraft
        ? {
            setDraft: {
              ...state.setDraft,
              math: { ...state.setDraft.math, ...patch },
              dirty: true,
              error: null,
            },
            setDraftError: null,
          }
        : state,
    ),

  cancelSetDraft: () => set({ setDraft: null, setDraftError: null }),

  commitSetDraft: () => {
    const state = get();
    const draft = state.setDraft;
    const line = state.scene.line;
    if (!draft || !line) return;
    const result = buildSetMath(line, { ...draft, dirty: true });
    if (result.set.error) {
      set({ setDraftError: result.set.error });
      return;
    }
    const sets = [...line.sets, result.set];
    const axisRowCount = Math.max(line.axisRowCount, result.line.axisRowCount);
    set({
      scene: {
        ...state.scene,
        line: { ...result.line, sets, axisRowCount },
      },
      setDraft: null,
      setDraftError: null,
      activeAxisRow: draft.axisRow,
    });
  },

  updateSetMath: (id, patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      return {
        scene: {
          ...state.scene,
          line: {
            ...state.scene.line,
            sets: state.scene.line.sets.map((set) =>
              set.id === id
                ? { ...set, math: { ...set.math, ...patch }, dirty: true, error: null }
                : set,
            ),
          },
        },
      };
    }),

  updateSetStyle: (id, patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      const line = state.scene.line;
      const sets = line.sets.map((set) => {
        if (set.id !== id) return set;
        const next = { ...set, style: { ...set.style, ...patch } };
        return next;
      });
      let points = line.points;
      if (patch.color) {
        points = points.map((point) =>
          point.math.sourceSetId === id && !point.style.colorManual
            ? { ...point, style: { ...point.style, color: patch.color! } }
            : point,
        );
      }
      return { scene: { ...state.scene, line: { ...line, sets, points } } };
    }),

  buildSet: (id) => {
    const state = get();
    const line = state.scene.line;
    if (!line) return;
    const set = line.sets.find((item) => item.id === id);
    if (!set) return;
    const result = buildSetMath(line, { ...set, dirty: true });
    const sets = line.sets.map((item) => (item.id === id ? result.set : item));
    set({
      scene: {
        ...state.scene,
        line: { ...result.line, sets },
      },
      status: result.set.error
        ? { built: 0, errors: [`Множество ${set.index}: ${result.set.error}`], at: Date.now() }
        : { built: 1, errors: [], at: Date.now() },
    });
  },

  removeSet: (id) =>
    set((state) => {
      if (!state.scene.line) return state;
      return {
        scene: {
          ...state.scene,
          line: removeSetFromLine(state.scene.line, id),
        },
      };
    }),

  startLinePointDraft: () => {
    const state = get();
    const line = state.scene.line;
    if (!line) return;
    const draft = createLinePoint(line.points.length + 1, state.activeAxisRow);
    set({ linePointDraft: draft, linePointDraftError: null });
  },

  updateLinePointDraft: (patch) =>
    set((state) =>
      state.linePointDraft
        ? { linePointDraft: { ...state.linePointDraft, ...patch }, linePointDraftError: null }
        : state,
    ),

  updateLinePointDraftMath: (patch) =>
    set((state) =>
      state.linePointDraft
        ? {
            linePointDraft: {
              ...state.linePointDraft,
              math: { ...state.linePointDraft.math, ...patch },
              dirty: true,
            },
            linePointDraftError: null,
          }
        : state,
    ),

  updateLinePointDraftStyle: (patch) =>
    set((state) =>
      state.linePointDraft
        ? {
            linePointDraft: {
              ...state.linePointDraft,
              style: { ...state.linePointDraft.style, ...patch },
            },
          }
        : state,
    ),

  cancelLinePointDraft: () => set({ linePointDraft: null, linePointDraftError: null }),

  commitLinePointDraft: () => {
    const state = get();
    const draft = state.linePointDraft;
    const line = state.scene.line;
    if (!draft || !line) return;
    const result = buildLinePoint(line, { ...draft, dirty: true });
    if (result.point.error) {
      set({ linePointDraftError: result.point.error });
      return;
    }
    set({
      scene: {
        ...state.scene,
        line: { ...line, points: [...line.points, result.point] },
      },
      linePointDraft: null,
      linePointDraftError: null,
    });
  },

  updateLinePointMath: (id, patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      return {
        scene: {
          ...state.scene,
          line: {
            ...state.scene.line,
            points: state.scene.line.points.map((point) =>
              point.id === id && !point.locked
                ? { ...point, math: { ...point.math, ...patch }, dirty: true, error: null }
                : point,
            ),
          },
        },
      };
    }),

  updateLinePointStyle: (id, patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      let line = state.scene.line;
      let points = line.points.map((point) => {
        if (point.id !== id) return point;
        const style = {
          ...point.style,
          ...patch,
          colorManual: patch.color !== undefined ? true : point.style.colorManual,
        };
        return { ...point, style };
      });
      const point = points.find((p) => p.id === id);
      if (point && patch.open !== undefined && point.locked) {
        line = syncSetFromBoundaryPoint({ ...line, points }, point, patch.open);
        points = line.points.map((p) => (p.id === id ? { ...p, style: { ...p.style, open: patch.open! } } : p));
      }
      return { scene: { ...state.scene, line: { ...line, points } } };
    }),

  buildLinePointItem: (id) => {
    const state = get();
    const line = state.scene.line;
    if (!line) return;
    const point = line.points.find((item) => item.id === id);
    if (!point) return;
    const result = buildLinePoint(line, { ...point, dirty: true });
    const points = line.points.map((item) => (item.id === id ? result.point : item));
    set({
      scene: { ...state.scene, line: { ...line, points } },
      status: result.point.error
        ? { built: 0, errors: [`Точка ${point.index}: ${result.point.error}`], at: Date.now() }
        : { built: 1, errors: [], at: Date.now() },
    });
  },

  removeLinePoint: (id) =>
    set((state) => {
      if (!state.scene.line) return state;
      const point = state.scene.line.points.find((p) => p.id === id);
      if (point?.locked) return state;
      return {
        scene: {
          ...state.scene,
          line: {
            ...state.scene.line,
            points: reindex(
              state.scene.line.points.filter((p) => p.id !== id),
            ) as SceneLinePoint[],
          },
        },
      };
    }),

  updateAxis: (axis, patch) =>
    set((state) => {
      let nextAxis: AxisSpec = { ...state.scene[axis], ...patch };

      if (
        state.scene.axisScaleMode === "independent" &&
        (patch.min !== undefined || patch.max !== undefined)
      ) {
        nextAxis = { ...nextAxis, gridStep: autoGridStepForAxis(nextAxis) };
      }

      const scene = { ...state.scene, [axis]: nextAxis } as PlotScene;
      if (patch.name !== undefined) {
        scene.graphs = scene.graphs.map((graph) => ({ ...graph, dirty: true }));
      }
      return { scene };
    }),

  updateAxisScale: (patch) =>
    set((state) => {
      const nextMode = patch.axisScaleMode ?? state.scene.axisScaleMode;
      let scene: PlotScene = {
        ...state.scene,
        axisScaleMode: nextMode,
        plotAspectRatio: patch.plotAspectRatio ?? state.scene.plotAspectRatio,
      };

      if (patch.axisScaleMode === "independent") {
        scene = {
          ...scene,
          xAxis: { ...scene.xAxis, gridStep: autoGridStepForAxis(scene.xAxis) },
          yAxis: { ...scene.yAxis, gridStep: autoGridStepForAxis(scene.yAxis) },
        };
      }

      return { scene };
    }),

  updateGrid: (patch) =>
    set((state) => ({ scene: { ...state.scene, grid: { ...state.scene.grid, ...patch } } })),

  updateAppearance: (patch) =>
    set((state) => ({
      scene: { ...state.scene, appearance: { ...state.scene.appearance, ...patch } },
    })),

  resetAppearance: () =>
    set((state) => ({
      scene: {
        ...state.scene,
        appearance: {
          ...(state.scene.space === "line" ? createLineScene().appearance : createScene().appearance),
        },
      },
    })),

  addGraph: () =>
    set((state) => ({
      scene: {
        ...state.scene,
        graphs: [...state.scene.graphs, createGraph(state.scene.graphs.length + 1)],
      },
    })),

  updateGraphMath: (id, patch) =>
    set((state) => ({
      scene: {
        ...state.scene,
        graphs: state.scene.graphs.map((graph) =>
          graph.id === id
            ? { ...graph, math: { ...graph.math, ...patch }, dirty: true, error: null }
            : graph,
        ),
      },
    })),

  updateGraphStyle: (id, patch) =>
    set((state) => ({
      scene: {
        ...state.scene,
        graphs: state.scene.graphs.map((graph) =>
          graph.id === id ? { ...graph, style: { ...graph.style, ...patch } } : graph,
        ),
      },
    })),

  removeGraph: (id) =>
    set((state) => ({
      scene: {
        ...state.scene,
        graphs: reindex(state.scene.graphs.filter((graph) => graph.id !== id)) as SceneGraph[],
        points: state.scene.points.map((point) =>
          point.math.graphId === id || point.math.graphIdB === id
            ? {
                ...point,
                math: {
                  ...point.math,
                  graphId: point.math.graphId === id ? null : point.math.graphId,
                  graphIdB: point.math.graphIdB === id ? null : point.math.graphIdB,
                },
                dirty: true,
              }
            : point,
        ),
      },
    })),




  updatePointMath: (id, patch) =>
    set((state) => ({
      scene: {
        ...state.scene,
        points: state.scene.points.map((point) =>
          point.id === id
            ? { ...point, math: { ...point.math, ...patch }, dirty: true, error: null }
            : point,
        ),
      },
    })),

  updatePointStyle: (id, patch) =>
    set((state) => ({
      scene: {
        ...state.scene,
        points: state.scene.points.map((point) =>
          point.id === id ? { ...point, style: { ...point.style, ...patch } } : point,
        ),
      },
    })),

  togglePointSolution: (id, index, show) =>
    set((state) => ({
      scene: {
        ...state.scene,
        points: state.scene.points.map((point) =>
          point.id === id && point.built
            ? {
                ...point,
                built: point.built.map((solution, position) =>
                  position === index ? { ...solution, show } : solution,
                ),
              }
            : point,
        ),
      },
    })),

  updateSolutionStyle: (id, index, patch) =>
    set((state) => ({
      scene: {
        ...state.scene,
        points: state.scene.points.map((point) =>
          point.id === id && point.built
            ? {
                ...point,
                built: point.built.map((solution, position) =>
                  position === index
                    ? { ...solution, style: { ...(solution.style ?? {}), ...patch } }
                    : solution,
                ),
              }
            : point,
        ),
      },
    })),

  removePoint: (id) =>
    set((state) => ({
      scene: {
        ...state.scene,
        points: reindex(state.scene.points.filter((point) => point.id !== id)) as ScenePoint[],
      },
    })),

  addCustomColor: (color) =>
    set((state) =>
      state.scene.customColors.includes(color)
        ? state
        : { scene: { ...state.scene, customColors: [...state.scene.customColors, color] } },
    ),

  buildGraph: (id) => {
    const report = buildScene(get().scene, { graphId: id });
    set({ scene: report.scene, status: { built: report.built, errors: report.errors, at: Date.now() } });
  },

  buildPoint: (id) => {
    const report = buildScene(get().scene, { pointId: id });
    set({ scene: report.scene, status: { built: report.built, errors: report.errors, at: Date.now() } });
  },

  buildAll: () => {
    const scene = get().scene;
    if (scene.space === "line" && scene.line) {
      const report = buildLineScene(scene.line);
      set({
        scene: { ...scene, line: report.line },
        status: { built: report.built, errors: report.errors, at: Date.now() },
      });
      return;
    }
    const report = buildScene(scene);
    set({ scene: report.scene, status: { built: report.built, errors: report.errors, at: Date.now() } });
  },

  importScene: (raw) => {
    const base = createScene();
    const input = (raw ?? {}) as Partial<PlotScene> & {
      grid?: Partial<GridSpec> & { followAxisStep?: boolean; stepX?: string; stepY?: string };
    };
    const legacyGrid = input.grid ?? {};
    const isLine = input.space === "line";
    const scene: PlotScene = isLine
      ? (() => {
          const lineBase = createLineScene().line!;
          const rawLine = normalizeLineAxisRows({
            ...(input.line ?? {}),
            axisRowCount: input.line?.axisRowCount ?? lineBase.axisRowCount,
            sets: input.line?.sets ?? [],
            points: filterAiLinePoints(input.line?.points),
          });
          const lineDefaults = createLineScene();
          return {
            ...lineDefaults,
            ...input,
            appearance: input.appearance
              ? { ...lineDefaults.appearance, ...input.appearance }
              : lineDefaults.appearance,
            line: {
              ...lineBase,
              ...rawLine,
              ticks: { ...lineBase.ticks, ...(rawLine.ticks ?? {}) },
              sets: (rawLine.sets ?? []).map((set, position) => ({
                ...createSet(position + 1, set.axisRow ?? 0),
                ...set,
                math: { ...createSet(position + 1, set.axisRow ?? 0).math, ...set.math },
                style: { ...createSet(position + 1, set.axisRow ?? 0).style, ...set.style },
                built: null,
                dirty: true,
                error: null,
              })),
              points: (rawLine.points ?? []).map((point, position) => ({
                ...createLinePoint(position + 1, point.axisRow ?? 0),
                ...point,
                math: { ...createLinePoint(position + 1, point.axisRow ?? 0).math, ...point.math },
                style: { ...createLinePoint(position + 1, point.axisRow ?? 0).style, ...point.style },
                built: null,
                dirty: true,
                error: null,
              })),
            },
            version: 1,
            space: "line",
          };
        })()
      : {
          ...base,
          ...input,
          axisScaleMode: input.axisScaleMode ?? base.axisScaleMode,
          plotAspectRatio: input.plotAspectRatio ?? base.plotAspectRatio,
          xAxis: migrateAxisImport(base.xAxis, (input.xAxis ?? {}) as Partial<AxisSpec>, legacyGrid.stepX ?? ""),
          yAxis: migrateAxisImport(base.yAxis, (input.yAxis ?? {}) as Partial<AxisSpec>, legacyGrid.stepY ?? ""),
          grid: { visible: legacyGrid.visible ?? base.grid.visible },
          appearance: input.appearance
            ? { ...base.appearance, ...input.appearance }
            : base.appearance,
          graphs: (input.graphs ?? []).map((graph, position) => ({
            ...createGraph(position + 1),
            ...graph,
            math: { ...createGraph(position + 1).math, ...graph.math },
            style: { ...createGraph(position + 1).style, ...graph.style },
            built: null,
            dirty: true,
          })),
          points: (input.points ?? []).map((point, position) => ({
            ...createPoint(position + 1),
            ...point,
            math: { ...createPoint(position + 1).math, ...point.math },
            style: { ...createPoint(position + 1).style, ...point.style },
            built: null,
            dirty: true,
          })),
          tangents: input.tangents ?? [],
          customColors: input.customColors ?? [],
          line: null,
          version: 1,
          space: "plane",
        };
    commitImportedScene(set, scene);
  },

  importAiScene: (raw) => {
    commitImportedScene(set, mergeAiScene(raw));
  },

  resetScene: () =>
    set((state) => ({
      scene: state.spaceTab === "line" ? createLineScene() : createScene(),
      status: null,
      pointDraft: null,
      pointDraftError: null,
      setDraft: null,
      setDraftError: null,
      linePointDraft: null,
      linePointDraftError: null,
      activeAxisRow: 0,
    })),
}));

