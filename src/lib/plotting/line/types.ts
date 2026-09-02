/** Типы сцены числовой прямой (режим «Прямая»). */

export type MajorLabelMode = "all" | "firstTwo" | "givenTwo" | "selected";
export type MinorLabelMode = "all" | "oneInterval";

/** Способ задания множества. */
export type SetKind = "interval" | "ray" | "freeform";

/** Визуализация множества на прямой. */
export type SetDisplay = "hatchRight" | "hatchLeft" | "arc" | "thickSegment";

/** Расположение визуализации относительно оси. */
export type SetPosition = "above" | "below";

export interface LineAxisSpec {
  name: string;
  unit: string;
  min: string;
  max: string;
  /** Шаг больших засечек. */
  majorStep: string;
}

export interface LineTickSettings {
  majorVisible: boolean;
  majorLabelMode: MajorLabelMode;
  /** Для режима «Подписать данные две». */
  majorLabelAnchor: string;
  /** Для режима «Избирательно» — через точку с запятой. */
  majorSelectedLabels: string;
  minorEnabled: boolean;
  /** Разделить большое деление на N частей. */
  minorDivisions: string;
  minorLabelMode: MinorLabelMode;
  /** Начало большого интервала для подписей мелких засечек. */
  minorLabelIntervalStart: string;
}

export interface SetMath {
  kind: SetKind;
  /** Конечный интервал: левая граница. */
  left: string;
  /** Конечный интервал: правая граница. */
  right: string;
  leftOp: "<" | "<=";
  rightOp: "<" | "<=";
  /** Луч: оператор сравнения. */
  rayOp: "<" | "<=" | ">" | ">=";
  /** Луч: граничная точка. */
  rayBoundary: string;
  /** Свободный ввод. */
  freeformInput: string;
}

export interface SetStyle {
  color: string;
  display: SetDisplay;
  position: SetPosition;
  visible: boolean;
}

/** Нормализованная часть множества после построения. */
export interface BuiltSetPart {
  left: number;
  right: number;
  leftInclusive: boolean;
  rightInclusive: boolean;
}

export interface BuiltSet {
  parts: BuiltSetPart[];
  /** Краткая математическая запись для заголовка. */
  displayText: string;
  latexText: string;
  /** Границы для синхронизации точек: ключ → координата. */
  boundaries: Array<{
    key: string;
    x: number;
    open: boolean;
    display: string;
  }>;
}

export interface SceneSet {
  id: string;
  index: number;
  /** Индекс горизонтального ряда оси (0 — верхний). */
  axisRow: number;
  math: SetMath;
  style: SetStyle;
  /** Способ задания фиксируется после первого успешного построения. */
  kindLocked: boolean;
  built: BuiltSet | null;
  dirty: boolean;
  error: string | null;
}

export interface LinePointMath {
  coordinate: string;
  /** ID множества-родителя для граничной точки. */
  sourceSetId: string | null;
  /** Ключ границы внутри множества. */
  boundaryKey: string | null;
}

export type LineLabelSide = "above" | "below";
export type LineLabelColorSource = "point" | "axis";

export interface LinePointStyle {
  color: string;
  /** Пользователь вручную сменил цвет — не синхронизировать с множеством. */
  colorManual: boolean;
  open: boolean;
  label: string;
  showCoords: boolean;
  visible: boolean;
  labelSide: LineLabelSide;
  labelColor: LineLabelColorSource;
  coordSide: LineLabelSide;
  coordColor: LineLabelColorSource;
  perpendicular: boolean;
}

export interface SceneLinePoint {
  id: string;
  index: number;
  axisRow: number;
  math: LinePointMath;
  style: LinePointStyle;
  built: { x: number; displayX: string; latex: string } | null;
  dirty: boolean;
  error: string | null;
  /** Граничные точки множеств нельзя удалить вручную. */
  locked: boolean;
}

export interface LineSceneData {
  axis: LineAxisSpec;
  ticks: LineTickSettings;
  /** Число горизонтальных рядов осей (≥ 1). */
  axisRowCount: number;
  sets: SceneSet[];
  points: SceneLinePoint[];
}

export const DEFAULT_LINE_TICKS: LineTickSettings = {
  majorVisible: true,
  majorLabelMode: "all",
  majorLabelAnchor: "",
  majorSelectedLabels: "",
  minorEnabled: false,
  minorDivisions: "5",
  minorLabelMode: "all",
  minorLabelIntervalStart: "",
};

export const LINE_APPEARANCE_OVERRIDES = {
  width: 720,
  height: 144,
  frame: false,
  padding: 16,
} as const;
