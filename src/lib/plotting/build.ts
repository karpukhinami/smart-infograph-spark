/**
 * Вычислительный слой: превращает математическое описание объекта сцены
 * в ломаные (в математических координатах), готовые для SVG-рисовальщика.
 */
import { compileEquation, compileExpression, evaluateNumber, parseBound } from "./math-expr";
import { qualitativeEvaluator, type Anchor } from "./qualitative";
import type { BuiltGraph, GraphMath, Polyline } from "./types";

export interface PlotBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const SAMPLES = 900;

function sampleFunction(
  fn: (x: number) => number,
  from: number,
  to: number,
  bounds: PlotBounds,
): Polyline[] {
  const segments: Polyline[] = [];
  let current: Polyline = [];
  const span = to - from;
  if (!(span > 0)) return segments;
  const ySpan = bounds.yMax - bounds.yMin;
  const limit = bounds.yMin - ySpan * 4;
  const ceiling = bounds.yMax + ySpan * 4;
  let previous: number | null = null;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = from + (span * i) / SAMPLES;
    const y = fn(x);
    const broken =
      !Number.isFinite(y) ||
      (previous !== null && Math.abs(y - previous) > ySpan * 8 && (y - previous) * 1 !== 0);
    if (broken) {
      if (current.length > 1) segments.push(current);
      current = [];
      previous = Number.isFinite(y) ? y : null;
      continue;
    }
    current.push([x, Math.min(ceiling, Math.max(limit, y))]);
    previous = y;
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Неявный график: марширующие квадраты по сетке значений. */
function sampleImplicit(
  fn: (x: number, y: number) => number,
  bounds: PlotBounds,
  xFrom: number,
  xTo: number,
): Polyline[] {
  const steps = 220;
  const dx = (xTo - xFrom) / steps;
  const dy = (bounds.yMax - bounds.yMin) / steps;
  if (!(dx > 0) || !(dy > 0)) return [];
  const values: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const row: number[] = [];
    const x = xFrom + dx * i;
    for (let j = 0; j <= steps; j++) row.push(fn(x, bounds.yMin + dy * j));
    values.push(row);
  }
  const segments: Polyline[] = [];
  const interpolate = (
    ax: number, ay: number, av: number,
    bx: number, by: number, bv: number,
  ): [number, number] => {
    const t = av === bv ? 0.5 : av / (av - bv);
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  };
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const x0 = xFrom + dx * i;
      const x1 = x0 + dx;
      const y0 = bounds.yMin + dy * j;
      const y1 = y0 + dy;
      const corners: Array<[number, number, number]> = [
        [x0, y0, values[i][j]],
        [x1, y0, values[i + 1][j]],
        [x1, y1, values[i + 1][j + 1]],
        [x0, y1, values[i][j + 1]],
      ];
      if (corners.some(([, , v]) => !Number.isFinite(v))) continue;
      const crossings: Array<[number, number]> = [];
      for (let k = 0; k < 4; k++) {
        const [ax, ay, av] = corners[k];
        const [bx, by, bv] = corners[(k + 1) % 4];
        if ((av <= 0 && bv > 0) || (av > 0 && bv <= 0)) {
          crossings.push(interpolate(ax, ay, av, bx, by, bv));
        }
      }
      if (crossings.length >= 2) segments.push([crossings[0], crossings[1]]);
      if (crossings.length === 4) segments.push([crossings[2], crossings[3]]);
    }
  }
  return segments;
}

function resolveDomain(
  math: GraphMath,
  fallbackFrom: number,
  fallbackTo: number,
): { from: number; to: number } {
  const from = math.domainFrom.trim() ? parseBound(math.domainFrom) : fallbackFrom;
  const to = math.domainTo.trim() ? parseBound(math.domainTo) : fallbackTo;
  const start = Math.max(Number.isFinite(from) ? from : fallbackFrom, fallbackFrom);
  const end = Math.min(Number.isFinite(to) ? to : fallbackTo, fallbackTo);
  if (!(end > start)) throw new Error("Пределы построения функции заданы неверно.");
  return { from: start, to: end };
}

export function parseAnchors(math: GraphMath): Anchor[] {
  if (math.anchors.length < 2) throw new Error("Нужно минимум 2 опорные точки.");
  return math.anchors.map((anchor, index) => {
    if (!anchor.x.trim() || !anchor.y.trim()) {
      throw new Error(`Опорная точка ${index + 1}: заполните обе координаты.`);
    }
    return { x: evaluateNumber(anchor.x), y: evaluateNumber(anchor.y), kind: anchor.kind };
  });
}

/** Построение одного графика. Бросает ошибку с понятным текстом. */
export function buildGraph(
  math: GraphMath,
  vars: { x: string; y: string },
  bounds: PlotBounds,
): BuiltGraph {
  switch (math.kind) {
    case "explicit": {
      if (!math.expression.trim()) throw new Error("Введите формулу функции.");
      const fn = compileExpression(math.expression, [vars.x]);
      const domain = resolveDomain(math, bounds.xMin, bounds.xMax);
      return {
        segments: sampleFunction((x) => fn({ [vars.x]: x }), domain.from, domain.to, bounds),
        domain,
      };
    }
    case "implicit": {
      if (!math.equation.trim()) throw new Error("Введите уравнение.");
      const fn = compileEquation(math.equation, [vars.x, vars.y]);
      const domain = resolveDomain(math, bounds.xMin, bounds.xMax);
      return {
        segments: sampleImplicit(
          (x, y) => fn({ [vars.x]: x, [vars.y]: y }),
          bounds,
          domain.from,
          domain.to,
        ),
        domain,
      };
    }
    case "piecewise": {
      if (!math.pieces.length) throw new Error("Добавьте хотя бы один участок.");
      const segments: Polyline[] = [];
      math.pieces.forEach((piece, index) => {
        if (!piece.expression.trim()) throw new Error(`Участок ${index + 1}: введите формулу.`);
        const fn = compileExpression(piece.expression, [vars.x]);
        const rawFrom = piece.from.trim() ? parseBound(piece.from) : -Infinity;
        const rawTo = piece.to.trim() ? parseBound(piece.to) : Infinity;
        if (!(rawTo > rawFrom)) throw new Error(`Участок ${index + 1}: границы заданы неверно.`);
        const from = Math.max(rawFrom, bounds.xMin);
        const to = Math.min(rawTo, bounds.xMax);
        if (!(to > from)) return;
        segments.push(...sampleFunction((x) => fn({ [vars.x]: x }), from, to, bounds));
      });
      return { segments };
    }
    case "qualitative": {
      const anchors = parseAnchors(math);
      const extendEnds = math.extendEnds !== false;
      const evaluator = qualitativeEvaluator(anchors, extendEnds ? "curve" : "linear");
      const sorted = [...anchors].sort((a, b) => a.x - b.x);
      // При гладком продолжении кривая идёт до краёв области построения,
      // иначе обрывается на крайних опорных точках.
      const domain = resolveDomain(
        math,
        extendEnds ? bounds.xMin : Math.max(sorted[0].x, bounds.xMin),
        extendEnds ? bounds.xMax : Math.min(sorted[sorted.length - 1].x, bounds.xMax),
      );
      return { segments: sampleFunction(evaluator, domain.from, domain.to, bounds), anchors, domain };
    }
    case "parametric": {
      // Возможность рисовальщика сохранена, в UI пока не используется.
      const xExpression = math.xExpression ?? "";
      const yExpression = math.yExpression ?? "";
      if (!xExpression.trim() || !yExpression.trim()) {
        throw new Error("Для параметрического графика нужны оба выражения.");
      }
      const fx = compileExpression(xExpression, ["t"]);
      const fy = compileExpression(yExpression, ["t"]);
      const from = math.domainFrom.trim() ? evaluateNumber(math.domainFrom) : 0;
      const to = math.domainTo.trim() ? evaluateNumber(math.domainTo) : Math.PI * 2;
      const points: Polyline = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const t = from + ((to - from) * i) / SAMPLES;
        const x = fx({ t });
        const y = fy({ t });
        if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
      }
      return { segments: points.length > 1 ? [points] : [] };
    }
    default:
      throw new Error("Неизвестный тип задания графика.");
  }
}

/**
 * Значение кусочно-заданной функции в точке с учётом строгости неравенств.
 * На стыке участков берётся та сторона, где неравенство нестрогое;
 * если строгие обе — функция в точке не определена.
 */
export function piecewiseValuesAt(
  math: GraphMath,
  vars: { x: string },
  x: number,
): Array<{ y: number; open: boolean }> {
  const parsed = math.pieces.map((piece, index) => {
    if (!piece.expression.trim()) throw new Error(`Участок ${index + 1}: введите формулу.`);
    return {
      piece,
      from: piece.from.trim() ? parseBound(piece.from) : -Infinity,
      to: piece.to.trim() ? parseBound(piece.to) : Infinity,
    };
  });

  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const candidates: Array<{ y: number; open: boolean }> = [];

  for (const item of parsed) {
    let open: boolean | null = null;
    if (x > item.from && x < item.to) open = false;
    else if (near(x, item.from)) open = !item.piece.includeFrom;
    else if (near(x, item.to)) open = !item.piece.includeTo;
    if (open === null) continue;
    const fn = compileExpression(item.piece.expression, [vars.x]);
    const y = fn({ [vars.x]: x });
    if (!Number.isFinite(y)) continue;
    const same = candidates.find((c) => near(c.y, y));
    if (same) {
      if (!open) same.open = false;
      continue;
    }
    candidates.push({ y, open });
  }

  if (!candidates.length) throw new Error("В этой координате график не определён.");
  return candidates;
}

