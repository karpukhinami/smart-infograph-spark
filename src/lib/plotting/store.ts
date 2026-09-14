/** Состояние страницы plotting. UI меняет только сцену; сцена — единый контракт. */
import { create } from "zustand";
import {
  EMPTY_POINT_MATH,
  buildScene,
  createGraph,
  createPoint,
  createScene,
  createSpacePlotScene,
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
import {
  buildSpaceSceneData,
  createAuxiliaryLineForPoint,
  createFigureFromInput,
  defaultParallelepipedConstraints,
  defaultPyramidConstraints,
  createPlaneIntersectionEndpoints,
  createSpaceLine,
  createSpacePlane,
  createSpacePoint,
  nextFreePointLabel,
  reindexSpace,
} from "./space/scene";
import type {
  LinearVisualKind,
  LineRegion,
  SpaceFigureConstraints,
  PointOnLineDefinition,
  SpaceLine,
  SpaceLineDefinition,
  SpacePlane,
  SpacePlaneDefinition,
  SpacePoint,
  SpaceSceneData,
  SpaceShapeKind,
} from "./space/types";
import { clampRegionParam, defaultLineParam } from "./space/build";
import { refreshPyramidVertices } from "./space/pyramid";

export interface SpacePointDraft {
  mode: "onLine" | "onFace";
  label: string;
  pointAId: string;
  pointBId: string;
  region: LineRegion;
  ratioMode: "auto" | "explicit";
  ratioA: number;
  ratioB: number;
  lineParam: number;
  faceId: string;
  placement: "arbitrary" | "center";
}

export interface SpaceLineDraft {
  kind: "twoPoints" | "planeIntersection";
  visualKind: LinearVisualKind;
  aId: string;
  bId: string;
  planeAId: string;
  planeBId: string;
}

export interface SpacePlaneDraft {
  definition: SpacePlaneDefinition;
}

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
  spacePointDraft: SpacePointDraft | null;
  spacePointDraftError: string | null;
  spaceLineDraft: SpaceLineDraft | null;
  spaceLineDraftError: string | null;
  spacePlaneDraft: SpacePlaneDraft | null;
  spacePlaneDraftError: string | null;
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
  setAllLinePerpendiculars: (enabled: boolean) => void;
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
  setSpaceShapeKind: (kind: SpaceShapeKind) => void;
  setSpaceBaseInput: (input: string) => void;
  buildSpaceFigure: () => void;
  updateSpaceConstraints: (patch: Partial<SpaceFigureConstraints>) => void;
  updateSpaceView: (patch: Partial<SpaceSceneData["view"]>) => void;
  startSpacePointDraft: () => void;
  updateSpacePointDraft: (patch: Partial<SpacePointDraft>) => void;
  cancelSpacePointDraft: () => void;
  commitSpacePointDraft: () => void;
  buildSpacePoint: (id: string) => void;
  updateSpacePoint: (id: string, patch: Partial<SpacePoint>) => void;
  updateSpacePointStyle: (id: string, patch: Partial<SpacePoint["style"]>) => void;
  updateSpacePointOnLine: (id: string, patch: Partial<PointOnLineDefinition>) => void;
  removeSpacePoint: (id: string) => void;
  startSpaceLineDraft: () => void;
  updateSpaceLineDraft: (patch: Partial<SpaceLineDraft>) => void;
  cancelSpaceLineDraft: () => void;
  commitSpaceLineDraft: () => void;
  buildSpaceLine: (id: string) => void;
  updateSpaceLine: (id: string, patch: Partial<SpaceLine>) => void;
  updateSpaceLineStyle: (id: string, patch: Partial<SpaceLine["style"]>) => void;
  removeSpaceLine: (id: string) => void;
  startSpacePlaneDraft: () => void;
  updateSpacePlaneDraft: (patch: Partial<SpacePlaneDraft>) => void;
  cancelSpacePlaneDraft: () => void;
  commitSpacePlaneDraft: () => void;
  buildSpacePlane: (id: string) => void;
  updateSpacePlane: (id: string, patch: Partial<SpacePlane>) => void;
  updateSpacePlaneStyle: (id: string, patch: Partial<SpacePlane["style"]>) => void;
  removeSpacePlane: (id: string) => void;
}


function patchSpaceData(
  state: PlotStore,
  updater: (data: SpaceSceneData) => SpaceSceneData,
): Partial<PlotStore> {
  const data = state.scene.space3d;
  if (!data) return {};
  return { scene: { ...state.scene, space3d: updater(data) } };
}

function applySpaceBuild(scene: PlotScene): { scene: PlotScene; status: BuildStatus } {
  const data = scene.space3d;
  if (!data) {
    return { scene, status: { built: 0, errors: ["Пространственная сцена не инициализирована."], at: Date.now() } };
  }
  const report = buildSpaceSceneData(data);
  return {
    scene: { ...scene, space3d: report.data },
    status: { built: report.built, errors: report.errors, at: Date.now() },
  };
}

function withSpaceData(
  state: PlotStore,
  updater: (data: SpaceSceneData) => SpaceSceneData,
): Partial<PlotStore> {
  const data = state.scene.space3d;
  if (!data) return {};
  const next = updater(data);
  return applySpaceBuild({ ...state.scene, space3d: next });
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
  if (scene.space === "space" && scene.space3d) {
    const report = buildSpaceSceneData(scene.space3d);
    set({
      scene: { ...scene, space3d: report.data },
      spaceTab: "space",
      status: { built: report.built, errors: report.errors, at: Date.now() },
      pointDraft: null,
      pointDraftError: null,
      setDraft: null,
      setDraftError: null,
      linePointDraft: null,
      linePointDraftError: null,
      spacePointDraft: null,
      spacePointDraftError: null,
      spaceLineDraft: null,
      spaceLineDraftError: null,
      spacePlaneDraft: null,
      spacePlaneDraftError: null,
    });
    return;
  }
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
  spacePointDraft: null,
  spacePointDraftError: null,
  spaceLineDraft: null,
  spaceLineDraftError: null,
  spacePlaneDraft: null,
  spacePlaneDraftError: null,
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
      if (spaceTab === "space") {
        return {
          spaceTab,
          scene: createSpacePlotScene(),
          status: null,
          pointDraft: null,
          pointDraftError: null,
          setDraft: null,
          setDraftError: null,
          linePointDraft: null,
          linePointDraftError: null,
          spacePointDraft: null,
          spacePointDraftError: null,
          spaceLineDraft: null,
          spaceLineDraftError: null,
          spacePlaneDraft: null,
          spacePlaneDraftError: null,
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
    const targetSet = line.sets.find((item) => item.id === id);
    if (!targetSet) return;
    const result = buildSetMath(line, { ...targetSet, dirty: true });
    const sets = line.sets.map((item) => (item.id === id ? result.set : item));
    set({
      scene: {
        ...state.scene,
        line: { ...result.line, sets },
      },
      status: result.set.error
        ? { built: 0, errors: [`Множество ${targetSet.index}: ${result.set.error}`], at: Date.now() }
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

  setAllLinePerpendiculars: (enabled) =>
    set((state) => {
      const line = state.scene.line;
      if (!line?.points.length) return state;
      return {
        scene: {
          ...state.scene,
          line: {
            ...line,
            points: line.points.map((point) => ({
              ...point,
              style: { ...point.style, perpendicular: enabled },
            })),
          },
        },
      };
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
    if (scene.space === "space" && scene.space3d) {
      const result = applySpaceBuild(scene);
      set({ scene: result.scene, status: result.status });
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
          space3d: null,
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
      scene:
        state.spaceTab === "line"
          ? createLineScene()
          : state.spaceTab === "space"
            ? createSpacePlotScene()
            : createScene(),
      status: null,
      pointDraft: null,
      pointDraftError: null,
      setDraft: null,
      setDraftError: null,
      linePointDraft: null,
      linePointDraftError: null,
      spacePointDraft: null,
      spacePointDraftError: null,
      spaceLineDraft: null,
      spaceLineDraftError: null,
      spacePlaneDraft: null,
      spacePlaneDraftError: null,
      activeAxisRow: 0,
    })),

  setSpaceShapeKind: (kind) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        shapeKind: kind,
        figure: null,
        figureDirty: false,
        baseVerticesInput: "",
        figureConstraints:
          kind === "pyramid"
            ? defaultPyramidConstraints()
            : kind === "parallelepiped"
              ? defaultParallelepipedConstraints()
              : data.figureConstraints,
      })),
    ),

  setSpaceBaseInput: (input) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        baseVerticesInput: input,
        figureDirty: data.figure ? true : data.figureDirty,
      })),
    ),

  buildSpaceFigure: () => {
    const state = get();
    const data = state.scene.space3d;
    if (!data?.shapeKind) return;
    const { figure, error } = createFigureFromInput(
      data.shapeKind,
      data.baseVerticesInput,
      data.figureConstraints,
    );
    if (!figure) {
      set({ status: { built: 0, errors: [error ?? "Ошибка создания фигуры."], at: Date.now() } });
      return;
    }
    const result = applySpaceBuild({
      ...state.scene,
      space3d: { ...data, figure, figureDirty: false },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpaceConstraints: (patch) => {
    const state = get();
    const data = state.scene.space3d;
    if (!data) return;
    const figureConstraints: SpaceFigureConstraints = {
      ...data.figureConstraints,
      ...patch,
    };
    if (!data.figure) {
      set((s) => patchSpaceData(s, (d) => ({ ...d, figureConstraints })));
      return;
    }

    let figure = { ...data.figure, constraints: { ...figureConstraints } } as typeof data.figure;
    if (figure.kind === "pyramid") {
      figure = refreshPyramidVertices(figure);
    }
    const result = applySpaceBuild({
      ...state.scene,
      space3d: { ...data, figureConstraints, figure, figureDirty: false },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpaceView: (patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        view: { ...data.view, ...patch },
      })),
    ),

  startSpacePointDraft: () => {
    const data = get().scene.space3d;
    if (!data?.figure) return;
    const verts = data.figure.vertices;
    set({
      spacePointDraft: {
        mode: "onLine",
        label: "",
        pointAId: verts[0]!.id,
        pointBId: verts[3]!.id,
        region: "between",
        ratioMode: "auto",
        ratioA: 1,
        ratioB: 2,
        lineParam: defaultLineParam("between"),
        faceId: data.figure.faces[0]!.id,
        placement: "arbitrary",
      },
      spacePointDraftError: null,
    });
  },

  updateSpacePointDraft: (patch) =>
    set((state) => ({
      spacePointDraft: state.spacePointDraft ? { ...state.spacePointDraft, ...patch } : state.spacePointDraft,
      spacePointDraftError: null,
    })),

  cancelSpacePointDraft: () => set({ spacePointDraft: null, spacePointDraftError: null }),

  commitSpacePointDraft: () => {
    const state = get();
    const draft = state.spacePointDraft;
    const data = state.scene.space3d;
    if (!draft || !data?.figure) return;

    const definition =
      draft.mode === "onLine"
        ? ({
            kind: "onLine" as const,
            pointAId: draft.pointAId,
            pointBId: draft.pointBId,
            region: draft.region,
            ratioMode: draft.ratioMode,
            ratioA: draft.ratioA,
            ratioB: draft.ratioB,
            lineParam: draft.lineParam,
          } satisfies PointOnLineDefinition)
        : ({
            kind: "onFace" as const,
            faceId: draft.faceId,
            placement: draft.placement,
            faceU: 0.35,
            faceV: 0.35,
          });

    let lines = data.lines;
    if (definition.kind === "onLine") {
      const aux = createAuxiliaryLineForPoint(data, definition);
      if (aux) lines = [...lines, aux];
    }

    const label = draft.label.trim() || nextFreePointLabel(data, data.figure);
    const point = createSpacePoint(data.points.length + 1, definition, label);
    point.built = true;

    const result = applySpaceBuild({
      ...state.scene,
      space3d: { ...data, points: [...data.points, point], lines },
    });
    set({
      scene: result.scene,
      status: result.status,
      spacePointDraft: null,
      spacePointDraftError: null,
    });
  },

  buildSpacePoint: (id) => {
    const state = get();
    const data = state.scene.space3d;
    if (!data?.figure) return;
    const target = data.points.find((p) => p.id === id);
    if (!target) return;
    let lines = data.lines;
    if (target.definition.kind === "onLine") {
      const aux = createAuxiliaryLineForPoint(data, target.definition);
      if (aux) lines = [...lines, aux];
    }
    const result = applySpaceBuild({
      ...state.scene,
      space3d: {
        ...data,
        lines,
        points: data.points.map((p) => (p.id === id ? { ...p, built: true, dirty: true } : p)),
      },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpacePoint: (id, patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        points: data.points.map((p) => (p.id === id ? { ...p, ...patch, dirty: true } : p)),
      })),
    ),

  updateSpacePointStyle: (id, patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        points: data.points.map((p) =>
          p.id === id ? { ...p, style: { ...p.style, ...patch } } : p,
        ),
      })),
    ),

  updateSpacePointOnLine: (id, patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        points: data.points.map((p) => {
          if (p.id !== id || p.definition.kind !== "onLine") return p;
          let def: PointOnLineDefinition = { ...p.definition, ...patch };
          if (patch.region !== undefined && patch.lineParam === undefined) {
            def = {
              ...def,
              region: patch.region,
              lineParam: defaultLineParam(patch.region),
              ratioMode: "auto",
            };
          }
          if (patch.lineParam !== undefined) {
            def.lineParam = clampRegionParam(def.region, patch.lineParam);
            def.ratioMode = "auto";
          }
          return { ...p, definition: def, dirty: true };
        }),
      })),
    ),

  removeSpacePoint: (id) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        points: reindexSpace(data.points.filter((p) => p.id !== id)),
      })),
    ),

  startSpaceLineDraft: () => {
    const data = get().scene.space3d;
    if (!data?.figure) return;
    const verts = data.figure.vertices;
    const faces = data.figure.faces;
    set({
      spaceLineDraft: {
        kind: "twoPoints",
        visualKind: "segment",
        aId: verts[0]!.id,
        bId: verts[3]!.id,
        planeAId: faces.find((f) => f.id === "f-left")?.id ?? faces[0]!.id,
        planeBId: faces.find((f) => f.id === "f-back")?.id ?? faces[1]!.id,
      },
      spaceLineDraftError: null,
    });
  },

  updateSpaceLineDraft: (patch) =>
    set((state) => ({
      spaceLineDraft: state.spaceLineDraft ? { ...state.spaceLineDraft, ...patch } : state.spaceLineDraft,
      spaceLineDraftError: null,
    })),

  cancelSpaceLineDraft: () => set({ spaceLineDraft: null, spaceLineDraftError: null }),

  commitSpaceLineDraft: () => {
    const state = get();
    const draft = state.spaceLineDraft;
    const data = state.scene.space3d;
    if (!draft || !data?.figure) return;
    if (draft.kind === "twoPoints" && draft.aId === draft.bId) {
      set({ spaceLineDraftError: "Выберите две различные точки." });
      return;
    }
    if (draft.kind === "planeIntersection" && draft.planeAId === draft.planeBId) {
      set({ spaceLineDraftError: "Выберите две различные плоскости." });
      return;
    }
    const definition: SpaceLineDefinition =
      draft.kind === "twoPoints"
        ? { kind: "twoPoints", aId: draft.aId, bId: draft.bId }
        : { kind: "planeIntersection", planeAId: draft.planeAId, planeBId: draft.planeBId };
    const line = createSpaceLine(data.lines.length + 1, definition, "");
    line.style.visualKind = draft.visualKind;
    line.built = true;
    const lines = [...data.lines, line];
    let points = data.points;
    if (draft.kind === "planeIntersection") {
      const endpoints = createPlaneIntersectionEndpoints({ ...data, lines }, line);
      if (endpoints.length) points = [...points, ...endpoints];
    }
    const result = applySpaceBuild({
      ...state.scene,
      space3d: { ...data, points, lines },
    });
    set({
      scene: result.scene,
      status: result.status,
      spaceLineDraft: null,
      spaceLineDraftError: null,
    });
  },

  buildSpaceLine: (id) => {
    const state = get();
    const data = state.scene.space3d;
    if (!data?.figure) return;
    const result = applySpaceBuild({
      ...state.scene,
      space3d: {
        ...data,
        lines: data.lines.map((l) => (l.id === id ? { ...l, built: true, dirty: true, label: "" } : l)),
      },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpaceLine: (id, patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        lines: data.lines.map((l) => (l.id === id ? { ...l, ...patch, dirty: true } : l)),
      })),
    ),

  updateSpaceLineStyle: (id, patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        lines: data.lines.map((l) =>
          l.id === id ? { ...l, style: { ...l.style, ...patch }, dirty: patch.visualKind ? true : l.dirty } : l,
        ),
      })),
    ),

  removeSpaceLine: (id) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        lines: reindexSpace(data.lines.filter((l) => l.id !== id)),
      })),
    ),

  startSpacePlaneDraft: () => {
    const data = get().scene.space3d;
    if (!data?.figure) return;
    const verts = data.figure.vertices;
    set({
      spacePlaneDraft: {
        definition: {
          kind: "threePoints",
          aId: verts[0]!.id,
          bId: verts[1]!.id,
          cId: verts[2]!.id,
        },
      },
      spacePlaneDraftError: null,
    });
  },

  updateSpacePlaneDraft: (patch) =>
    set((state) => ({
      spacePlaneDraft: state.spacePlaneDraft
        ? { ...state.spacePlaneDraft, ...patch, definition: patch.definition ?? state.spacePlaneDraft.definition }
        : state.spacePlaneDraft,
      spacePlaneDraftError: null,
    })),

  cancelSpacePlaneDraft: () => set({ spacePlaneDraft: null, spacePlaneDraftError: null }),

  commitSpacePlaneDraft: () => {
    const state = get();
    const draft = state.spacePlaneDraft;
    const data = state.scene.space3d;
    if (!draft || !data?.figure) return;
    const def = draft.definition;
    if (def.kind === "threePoints" && new Set([def.aId, def.bId, def.cId]).size < 3) {
      set({ spacePlaneDraftError: "Выберите три различные точки." });
      return;
    }
    if (def.kind === "twoLines" && def.lineAId === def.lineBId) {
      set({ spacePlaneDraftError: "Выберите две различные прямые." });
      return;
    }
    if (def.kind === "lineParallelToLine" && def.throughLineId === def.parallelToLineId) {
      set({ spacePlaneDraftError: "Выберите две различные прямые." });
      return;
    }
    const plane = createSpacePlane(data.planes.length + 1, def, "");
    plane.built = true;
    const result = applySpaceBuild({
      ...state.scene,
      space3d: { ...data, planes: [...data.planes, plane] },
    });
    set({
      scene: result.scene,
      status: result.status,
      spacePlaneDraft: null,
      spacePlaneDraftError: null,
    });
  },

  buildSpacePlane: (id) => {
    const state = get();
    const data = state.scene.space3d;
    if (!data?.figure) return;
    const result = applySpaceBuild({
      ...state.scene,
      space3d: {
        ...data,
        planes: data.planes.map((p) => (p.id === id ? { ...p, built: true, dirty: true } : p)),
      },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpacePlane: (id, patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        planes: data.planes.map((p) => (p.id === id ? { ...p, ...patch, dirty: true } : p)),
      })),
    ),

  updateSpacePlaneStyle: (id, patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        planes: data.planes.map((p) =>
          p.id === id ? { ...p, style: { ...p.style, ...patch } } : p,
        ),
      })),
    ),

  removeSpacePlane: (id) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        planes: reindexSpace(data.planes.filter((p) => p.id !== id)),
      })),
    ),
}));

