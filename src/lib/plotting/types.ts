/**
 * Единая структура сцены математического чертежа.
 *
 * Это внутренний контракт между ручным UI, будущим AI-UI, вычислительным слоем
 * и SVG-рисовальщиком. Пользователь никогда не редактирует её вручную.
 */
import type { LabelPlacement } from "./label-layout";

/** Значение, которое может быть задано математическим выражением. */
export interface MathValue {
  /** Исходный ввод пользователя, например "pi/2". */
  input: string;
  /** Нормализованное выражение, например "pi / 2". */
  normalized: string;
  /** Численное значение для вычислений. */
  value: number;
  /** Математическая форма для подписи (unicode), например "π/2". */
  display: string;
  /** LaTeX-форма для предпросмотра. */
  latex?: string;
}

export type PlotSpace = "line" | "plane" | "space";

/** Полная ось или только положительная полуось. */
export type AxisMode = "full" | "positive";

/** Формат подписей шкалы. */
export type TickLabelFormat = "number" | "fraction" | "pi";

/** Правило расстановки засечек и подписей. */
export type MarkRule = "zeroOnly" | "zeroAndFirst" | "all" | "selected";

export interface AxisSpec {
  /** Математическое имя переменной оси. */
  name: string;
  /** Единица измерения (необязательно). */
  unit: string;
  min: string;
  max: string;
  mode: AxisMode;
  /** Автоматический выбор цены деления. */
  stepAuto: boolean;
  /** Ручная цена деления (выражение, например "pi/4"). */
  step: string;
  labelFormat: TickLabelFormat;
  markRule: MarkRule;
  /** Избирательные засечки: значения через запятую. */
  selectedMarks: string;
}

/**
 * Сетка. Хранится отдельно от засечек, чтобы позже можно было развести
 * шаг сетки и шаг подписей (например, сетка π/4, подписи π/2).
 */
export interface GridSpec {
  visible: boolean;
  /** Использовать цену деления осей как шаг сетки. */
  followAxisStep: boolean;
  stepX: string;
  stepY: string;
}

/** Визуальное оформление координатной системы. */
export interface PlotAppearance {
  width: number;
  height: number;
  /** Равный масштаб по осям: клетки сетки квадратные. */
  equalScale: boolean;
  padding: number;

  axisWidth: number;
  axisColor: string;
  arrowSize: number;
  gridWidth: number;
  gridColor: string;
  frame: boolean;
  frameWidth: number;
  frameColor: string;
  tickWidth: number;
  tickSize: number;
  labelFontFamily: string;
  labelFontSize: number;
  labelColor: string;
  graphWidth: number;
  pointRadius: number;
  pointLabelFontSize: number;
  pointLabelFontFamily: string;
  projectionWidth: number;
  projectionColor: string;
}

export type GraphKind = "explicit" | "implicit" | "piecewise" | "qualitative" | "parametric";

export interface PiecewisePiece {
  expression: string;
  from: string;
  to: string;
  includeFrom: boolean;
  includeTo: boolean;
}

export type AnchorKind = "plain" | "min" | "max";

export interface AnchorPoint {
  x: string;
  y: string;
  kind: AnchorKind;
}

/** Математическая часть графика. */
export interface GraphMath {
  kind: GraphKind;
  /** Явное задание: выражение от горизонтальной переменной. */
  expression: string;
  /** Неявное задание: полное уравнение с обеими переменными. */
  equation: string;
  /** Кусочно-аналитическое задание. */
  pieces: PiecewisePiece[];
  /** Опорные точки качественного графика. */
  anchors: AnchorPoint[];
  /** Гладко продолжать качественную кривую за крайние опорные точки. */
  extendEnds?: boolean;
  /** Собственные пределы построения (необязательно). */
  domainFrom: string;
  domainTo: string;
  /** Параметрическое задание (зарезервировано, в UI пока нет). */
  xExpression?: string;
  yExpression?: string;
}

/** Визуальная часть графика. */
export interface GraphStyle {
  color: string;
  width: number | null;
  label: string;
  visible: boolean;
}

/** Результат построения: ломаные в математических координатах. */
export type Polyline = Array<[number, number]>;

export interface BuiltGraph {
  segments: Polyline[];
  /** Опорные точки после разбора (для качественного графика). */
  anchors?: Array<{ x: number; y: number; kind: AnchorKind }>;
  domain?: { from: number; to: number };
}

export interface SceneGraph {
  id: string;
  /** Порядковый номер для интерфейса. */
  index: number;
  math: GraphMath;
  style: GraphStyle;
  /** Последнее успешно построенное состояние. */
  built: BuiltGraph | null;
  /** Есть непостроенные изменения. */
  dirty: boolean;
  error: string | null;
}

export type PointMode = "plane" | "onGraph" | "intersection" | "anchor";

export interface PointMath {
  mode: PointMode;
  x: string;
  y: string;
  graphId: string | null;
  graphIdB: string | null;
  /** Выбранная опорная точка качественного графика. */
  anchorIndex: number | null;
}


export interface PointStyle {
  color: string;
  open: boolean;
  label: string;
  showCoords: boolean;
  visible: boolean;
  projectX: boolean;
  projectY: boolean;
  labelProjectionX: boolean;
  labelProjectionY: boolean;
  /** "auto" — автоматическая раскладка; направление — фиксированное положение. */
  labelPlacement?: LabelPlacement;
}

/** Одно найденное решение (точка может давать несколько). */
export interface PointSolution {
  x: number;
  y: number;
  displayX: string;
  displayY: string;
  show: boolean;
  /** Индивидуальное оформление этого решения (перекрывает style точки). */
  style?: Partial<PointStyle>;
}

export interface ScenePoint {
  id: string;
  index: number;
  math: PointMath;
  style: PointStyle;
  built: PointSolution[] | null;
  dirty: boolean;
  error: string | null;
}

/** Касательные: пока только зарезервированный тип объектов. */
export interface SceneTangent {
  id: string;
  index: number;
  graphId: string | null;
  at: string;
  style: { color: string; visible: boolean };
}

export interface PlotScene {
  version: 1;
  space: PlotSpace;
  xAxis: AxisSpec;
  yAxis: AxisSpec;
  grid: GridSpec;
  appearance: PlotAppearance;
  graphs: SceneGraph[];
  points: ScenePoint[];
  tangents: SceneTangent[];
  /** Пользовательские цвета текущего чертежа. */
  customColors: string[];
}

/** Данные, которые получает SVG-рисовальщик (никакого UI-состояния). */
export interface RenderCurve {
  color: string;
  width: number;
  segments: Polyline[];
}

export interface RenderPoint {
  id: string;
  x: number;
  y: number;
  color: string;
  open: boolean;
  label: string;
  coords: string | null;
  projectX: boolean;
  projectY: boolean;
  labelProjectionX: string | null;
  labelProjectionY: string | null;
  labelPlacement?: LabelPlacement;
}
