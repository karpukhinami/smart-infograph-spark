/** Пространственная сцена: семантическое описание 3D-объектов. */

export type SpaceShapeKind =
  | "parallelepiped"
  | "pyramid"
  | "prism"
  | "cone"
  | "sphere"
  | "cylinder";

export const SPACE_SHAPE_OPTIONS: Array<{ value: SpaceShapeKind; label: string; enabled: boolean }> = [
  { value: "parallelepiped", label: "Параллелепипед", enabled: true },
  { value: "pyramid", label: "Пирамида", enabled: false },
  { value: "prism", label: "Призма", enabled: false },
  { value: "cone", label: "Конус", enabled: false },
  { value: "sphere", label: "Шар", enabled: false },
  { value: "cylinder", label: "Цилиндр", enabled: false },
];

/** Коэффициенты радиус-вектора по базису e1=AB, e2=AD, e3=AA₁. */
export interface LocalCoords {
  u: number;
  v: number;
  w: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SpaceVertex {
  id: string;
  /** Отображаемое имя: A, B, C₁ … */
  label: string;
  /** Фиксированные коэффициенты для вершин параллелепипеда. */
  local: LocalCoords;
  /** Вершина тела — не удаляется пользователем. */
  builtin: boolean;
}

export interface SpaceEdge {
  id: string;
  aId: string;
  bId: string;
  /** Ребро исходного тела. */
  builtin: boolean;
}

export interface SpaceFace {
  id: string;
  vertexIds: [string, string, string, string];
  builtin: boolean;
}

export interface ParallelepipedConstraints {
  rectangular: boolean;
  equilateral: boolean;
  /** Визуальный угол ∠BAD на чертеже (10–60°); 3D-геометрию не меняет. */
  badAngleDeg: number;
}

export interface ParallelepipedFigure {
  id: string;
  kind: "parallelepiped";
  /** Четыре буквы нижнего основания, как ввёл пользователь. */
  baseLabels: [string, string, string, string];
  constraints: ParallelepipedConstraints;
  vertices: SpaceVertex[];
  edges: SpaceEdge[];
  faces: SpaceFace[];
}

export type LineRegion = "before" | "between" | "after";

export type PointOnLineDefinition = {
  kind: "onLine";
  pointAId: string;
  pointBId: string;
  region: LineRegion;
  ratioMode: "auto" | "explicit";
  ratioA: number;
  ratioB: number;
  /** Параметр t на носителе: r(t)=r(A)+t(r(B)-r(A)); сохраняется для детерминизма. */
  lineParam: number;
};

export type PointOnFaceDefinition = {
  kind: "onFace";
  faceId: string;
  placement: "arbitrary" | "center";
  /** Аффинные координаты внутри грани (0…1). */
  faceU: number;
  faceV: number;
};

export type PointOnSpaceLineDefinition = {
  kind: "onSpaceLine";
  lineId: string;
  /** Параметр t на носителе прямой: P = origin + t·dir. */
  lineParam: number;
};

export type SpacePointDefinition =
  | { kind: "builtin"; vertexId: string }
  | PointOnLineDefinition
  | PointOnFaceDefinition
  | PointOnSpaceLineDefinition;

export interface SpacePointStyle {
  color: string;
  visible: boolean;
  labelPlacement?: import("../label-layout").LabelPlacement;
}

export interface BuiltSpacePoint {
  local: LocalCoords;
  world: Vec3;
}

export interface SpacePoint {
  id: string;
  index: number;
  label: string;
  definition: SpacePointDefinition;
  style: SpacePointStyle;
  /** Пользователь нажал «Построить». */
  built: boolean;
  geometry: BuiltSpacePoint | null;
  lastBuilt: BuiltSpacePoint | null;
  dirty: boolean;
  error: string | null;
}

export type LinearVisualKind = "segment" | "line" | "vector";

export type SpaceLineDefinition =
  | { kind: "twoPoints"; aId: string; bId: string }
  | { kind: "planeIntersection"; planeAId: string; planeBId: string };

export interface SpaceLineStyle {
  color: string;
  width: number;
  visible: boolean;
  visualKind: LinearVisualKind;
}

export interface SpaceLine {
  id: string;
  index: number;
  label: string;
  definition: SpaceLineDefinition;
  style: SpaceLineStyle;
  built: boolean;
  dirty: boolean;
  error: string | null;
  lastOk: boolean;
}

export type SpacePlaneDefinition =
  | { kind: "threePoints"; aId: string; bId: string; cId: string }
  | { kind: "pointAndLine"; pointId: string; lineId: string }
  | { kind: "twoLines"; lineAId: string; lineBId: string }
  | { kind: "lineParallelToLine"; throughLineId: string; parallelToLineId: string };

export interface SpacePlaneStyle {
  color: string;
  visible: boolean;
  /** Бледность вспомогательных линий вне тела. */
  helperOpacity: number;
}

export interface SpacePlane {
  id: string;
  index: number;
  label: string;
  definition: SpacePlaneDefinition;
  style: SpacePlaneStyle;
  built: boolean;
  dirty: boolean;
  error: string | null;
  lastOk: boolean;
}

/** Параметры вида: меняют только проекцию, не геометрию сцены. */
export interface SpaceViewParams {
  /** Базовый масштаб ребра AD на экране (уточняется авто-fit). */
  scale: number;
  /** Поворот вокруг вертикальной оси, градусы (0 = исходный ракурс). */
  yaw: number;
  /** Показать эллипс вращения основания пунктиром. */
  showRotationEllipse?: boolean;
  pitch: number;
  /** @deprecated kx/ky вычисляются из badAngleDeg и depthLength */
  depthSkewX: number;
  /** @deprecated kx/ky вычисляются из badAngleDeg и depthLength */
  depthSkewY: number;
  /** Фиксированная визуальная длина единичного глубинного ребра AB на чертеже. */
  depthLength?: number;
  /** Визуальная длина единичного ребра AA₁ на чертеже. */
  heightLength?: number;
  /** Масштаб по X при переводе depthScreen → kx; по умолчанию = scale. */
  scaleX?: number;
  /** Масштаб по Y при переводе depthScreen → ky; по умолчанию = scale. */
  scaleY?: number;
  /** @deprecated используйте depthSkewX */
  oblique?: number;
  /** Режим видимости: school (фикс. ракурс) или legacy (окклюзия по экрану). */
  visibilityMode?: "school" | "legacy";
}

export interface SpaceAppearance {
  width: number;
  height: number;
  padding: number;
  edgeWidth: number;
  edgeColor: string;
  hiddenDash: string;
  labelFontSize: number;
  labelFontFamily: string;
  labelColor: string;
  pointRadius: number;
  lineWidth: number;
  lineExtension: number;
  planeFillOpacity: number;
}

export interface SpaceSceneData {
  shapeKind: SpaceShapeKind | null;
  baseVerticesInput: string;
  /** Ограничения фигуры (редактируются до и после построения). */
  figureConstraints: ParallelepipedConstraints;
  /** Параметры фигуры изменены после последнего построения. */
  figureDirty: boolean;
  /** Построенная фигура; null — на canvas ничего нет. */
  figure: ParallelepipedFigure | null;
  points: SpacePoint[];
  lines: SpaceLine[];
  planes: SpacePlane[];
  view: SpaceViewParams;
  appearance: SpaceAppearance;
}

/** Временный сегмент линии для renderer (не сериализуется). */
export interface RenderLineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  visible: boolean;
  color: string;
  width: number;
  dashed: boolean;
  sourceId: string;
  arrowEnd?: boolean;
}

export interface RenderSpaceLabel {
  id: string;
  text: string;
  anchorX: number;
  anchorY: number;
  color: string;
}

export interface BuiltSpaceGeometry {
  points: Map<string, BuiltSpacePoint>;
  /** screen coords + depth */
  projected: Map<string, { x: number; y: number; depth: number }>;
}
