/** Состояние страницы plotting. UI меняет только сцену; сцена — единый контракт. */
import { create } from "zustand";
import {
  DEFAULT_APPEARANCE,
  EMPTY_POINT_MATH,
  buildScene,
  createGraph,
  createPoint,
  createScene,
  solvePointMath,
} from "./scene";
import type {
  AxisSpec,
  GraphMath,
  GraphStyle,
  GridSpec,
  PlotAppearance,
  PlotScene,
  PointMath,
  PointStyle,
  SceneGraph,
  ScenePoint,
} from "./types";

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
  setInputMode: (mode: PlotInputMode) => void;
  setSpaceTab: (tab: PlotSpaceTab) => void;
  updateAxis: (axis: "xAxis" | "yAxis", patch: Partial<AxisSpec>) => void;
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
  resetScene: () => void;
}


function reindex<T extends { index: number }>(items: T[]): T[] {
  return items.map((item, position) => ({ ...item, index: position + 1 }));
}

export const usePlotStore = create<PlotStore>((set, get) => ({
  scene: createScene(),
  inputMode: "manual",
  spaceTab: "plane",
  status: null,
  pointDraft: null,
  pointDraftError: null,

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
      // Каждое найденное решение становится отдельной плашкой точки.
      const created = solutions.map((solution, position) =>
        ({
          ...createPoint(state.scene.points.length + position + 1, draft, {
            open: Boolean(solution.style?.open),
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
  setSpaceTab: (spaceTab) => set({ spaceTab }),

  updateAxis: (axis, patch) =>
    set((state) => {
      const scene = { ...state.scene, [axis]: { ...state.scene[axis], ...patch } } as PlotScene;
      // При изменении имени оси зависимые объекты требуют перепроверки.
      if (patch.name !== undefined) {
        scene.graphs = scene.graphs.map((graph) => ({ ...graph, dirty: true }));
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
    set((state) => ({ scene: { ...state.scene, appearance: { ...DEFAULT_APPEARANCE } } })),

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
    const report = buildScene(get().scene);
    set({ scene: report.scene, status: { built: report.built, errors: report.errors, at: Date.now() } });
  },

  importScene: (raw) => {
    const base = createScene();
    const input = (raw ?? {}) as Partial<PlotScene>;
    const scene: PlotScene = {
      ...base,
      ...input,
      xAxis: { ...base.xAxis, ...(input.xAxis ?? {}) },
      yAxis: { ...base.yAxis, ...(input.yAxis ?? {}) },
      grid: { ...base.grid, ...(input.grid ?? {}) },
      appearance: { ...base.appearance, ...(input.appearance ?? {}) },
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
      version: 1,
      space: "plane",
    };
    const report = buildScene(scene);
    set({ scene: report.scene, status: { built: report.built, errors: report.errors, at: Date.now() } });
  },

  resetScene: () => set({ scene: createScene(), status: null }),
}));
