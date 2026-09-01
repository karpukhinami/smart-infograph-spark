/**
 * Автоматическая раскладка текстовых подписей на чертеже.
 *
 * Движок общий: сейчас его использует подпись точки (буква + координаты как
 * один блок), позже так же будут размещаться подписи графиков и любые другие
 * подписи. Логика не знает ничего про математику — только про прямоугольники,
 * ломаные в пикселях и веса конфликтов.
 *
 * Принцип:
 *  1. Для каждой подписи перебирается ограниченный набор позиций-кандидатов
 *     вокруг опорной точки (8 направлений).
 *  2. Каждый кандидат получает штраф за пересечения и близость к уже
 *     нарисованным объектам, за выход за рабочую область и прижатие к краю.
 *  3. Выбирается кандидат с наименьшим штрафом; уже размещённая подпись сама
 *     становится препятствием для следующих (поэтому подписи не наезжают
 *     друг на друга).
 *  4. Если даже лучший кандидат конфликтует, подписи включается
 *     полупрозрачная подложка по контуру глифов (85 % непрозрачности).
 *
 * Раскладка не хранится в сцене: она пересчитывается на каждый рендер, значит
 * появление нового графика, точки или подписи автоматически переставляет
 * подписи в новые удачные места. Ручное положение (placement !== "auto")
 * фиксируется и в переборе не участвует.
 */

export type LabelDirection =
  | "top"
  | "topRight"
  | "right"
  | "bottomRight"
  | "bottom"
  | "bottomLeft"
  | "left"
  | "topLeft";

/** Порядок кандидатов задаёт предпочтение при равных штрафах. */
export const LABEL_DIRECTIONS: LabelDirection[] = [
  "topRight",
  "top",
  "right",
  "topLeft",
  "bottomRight",
  "left",
  "bottom",
  "bottomLeft",
];

export type LabelPlacement = LabelDirection | "auto";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Виды препятствий в порядке убывания важности. Сетка — наименее значимый
 * элемент: поверх неё подпись стоять может.
 */
export type ObstacleKind =
  | "label" // другая подпись точки/графика
  | "point" // сама точка или другая точка
  | "axisLabel" // числовые подписи шкалы и названия осей
  | "axis"
  | "curve"
  | "helper" // проекции, вспомогательные линии
  | "grid";

const KIND_WEIGHT: Record<ObstacleKind, number> = {
  label: 1000,
  point: 700,
  axisLabel: 500,
  axis: 320,
  curve: 180,
  helper: 90,
  grid: 0,
};

export interface RectObstacle {
  kind: ObstacleKind;
  rect: Rect;
}

export interface PathObstacle {
  kind: ObstacleKind;
  /** Ломаная в пиксельных координатах полотна. */
  points: Array<[number, number]>;
}

export type Obstacle = RectObstacle | PathObstacle;

export interface LabelRequest {
  id: string;
  /** Опорная точка (центр объекта), пиксели. */
  anchorX: number;
  anchorY: number;
  /** Габарит текстового блока. */
  width: number;
  height: number;
  /** Отступ от опорной точки. */
  gap: number;
  /** "auto" — подбирать; конкретное направление — фиксировать. */
  placement?: LabelPlacement;
}

export interface PlacedLabel {
  id: string;
  direction: LabelDirection;
  rect: Rect;
  /** Координаты для <text>: x с учётом text-anchor, y — базовая линия. */
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  /** Нужна ли полупрозрачная подложка (место не идеальное). */
  needsBackdrop: boolean;
}

/** Приблизительная ширина строки: без DOM, по средним ширинам символов. */
export function measureTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const char of String(text ?? "")) {
    if (/[iljItf.,;:'`!|()\[\]{}\-−–\s]/.test(char)) units += 0.32;
    else if (/[mwMW]/.test(char)) units += 0.86;
    else if (/[A-ZА-ЯЁ0-9]/.test(char)) units += 0.58;
    else units += 0.5;
  }
  return units * fontSize;
}

function isPath(obstacle: Obstacle): obstacle is PathObstacle {
  return Array.isArray((obstacle as PathObstacle).points);
}

function inflate(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + by * 2, height: rect.height + by * 2 };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

/** Пересечение отрезка с прямоугольником (алгоритм Лианга — Барски). */
function segmentHitsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: Rect,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const edges: Array<[number, number]> = [
    [-dx, x1 - rect.x],
    [dx, rect.x + rect.width - x1],
    [-dy, y1 - rect.y],
    [dy, rect.y + rect.height - y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return true;
}

function pathHitsRect(points: Array<[number, number]>, rect: Rect): boolean {
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return true;
  }
  return points.length === 1
    ? points[0]![0] >= rect.x &&
        points[0]![0] <= rect.x + rect.width &&
        points[0]![1] >= rect.y &&
        points[0]![1] <= rect.y + rect.height
    : false;
}

function directionRect(request: LabelRequest, direction: LabelDirection): Rect {
  const { anchorX: ax, anchorY: ay, width: w, height: h, gap } = request;
  const dx = gap + w / 2;
  const dy = gap + h / 2;
  const diag = 0.72;
  let cx = ax;
  let cy = ay;
  switch (direction) {
    case "top":
      cy = ay - dy;
      break;
    case "bottom":
      cy = ay + dy;
      break;
    case "left":
      cx = ax - dx;
      break;
    case "right":
      cx = ax + dx;
      break;
    case "topRight":
      cx = ax + dx * diag;
      cy = ay - dy * diag;
      break;
    case "topLeft":
      cx = ax - dx * diag;
      cy = ay - dy * diag;
      break;
    case "bottomRight":
      cx = ax + dx * diag;
      cy = ay + dy * diag;
      break;
    case "bottomLeft":
      cx = ax - dx * diag;
      cy = ay + dy * diag;
      break;
  }
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

const NEAR_MARGIN = 4;
const NEAR_FACTOR = 0.35;
const EDGE_MARGIN = 6;
const OUTSIDE_WEIGHT = 5000;
const EDGE_WEIGHT = 220;
/** Штраф, выше которого включается подложка. */
const BACKDROP_THRESHOLD = 1;

function penalty(rect: Rect, obstacles: Obstacle[], area: Rect): number {
  let score = 0;
  // Выход за рабочую область и прижатие к краю.
  const outside =
    Math.max(0, area.x - rect.x) +
    Math.max(0, rect.x + rect.width - (area.x + area.width)) +
    Math.max(0, area.y - rect.y) +
    Math.max(0, rect.y + rect.height - (area.y + area.height));
  if (outside > 0) score += OUTSIDE_WEIGHT + outside * 20;
  const edgeGap = Math.min(
    rect.x - area.x,
    area.x + area.width - (rect.x + rect.width),
    rect.y - area.y,
    area.y + area.height - (rect.y + rect.height),
  );
  if (edgeGap >= 0 && edgeGap < EDGE_MARGIN) score += EDGE_WEIGHT * (1 - edgeGap / EDGE_MARGIN);

  const near = inflate(rect, NEAR_MARGIN);
  for (const obstacle of obstacles) {
    const weight = KIND_WEIGHT[obstacle.kind];
    if (weight === 0) continue;
    if (isPath(obstacle)) {
      if (pathHitsRect(obstacle.points, rect)) score += weight;
      else if (pathHitsRect(obstacle.points, near)) score += weight * NEAR_FACTOR;
    } else {
      if (rectsOverlap(obstacle.rect, rect)) score += weight;
      else if (rectsOverlap(obstacle.rect, near)) score += weight * NEAR_FACTOR;
    }
  }
  return score;
}

/**
 * Раскладывает подписи по очереди: каждая размещённая подпись становится
 * препятствием для следующих.
 */
export function layoutLabels(
  requests: LabelRequest[],
  obstacles: Obstacle[],
  area: Rect,
  options?: { fontSize?: number },
): PlacedLabel[] {
  const fontSize = options?.fontSize ?? 16;
  const live = [...obstacles];
  const placed: PlacedLabel[] = [];

  for (const request of requests) {
    const fixed = request.placement && request.placement !== "auto" ? request.placement : null;
    let best: { direction: LabelDirection; rect: Rect; score: number } | null = null;
    const candidates = fixed ? [fixed] : LABEL_DIRECTIONS;
    candidates.forEach((direction, index) => {
      const rect = directionRect(request, direction);
      // Небольшой бонус за более предпочтительное направление.
      const score = penalty(rect, live, area) + index * 0.5;
      if (!best || score < best.score) best = { direction, rect, score };
    });
    if (!best) continue;
    const chosen = best as { direction: LabelDirection; rect: Rect; score: number };
    placed.push({
      id: request.id,
      direction: chosen.direction,
      rect: chosen.rect,
      x: chosen.rect.x + chosen.rect.width / 2,
      y: chosen.rect.y + chosen.rect.height / 2 + fontSize * 0.35,
      textAnchor: "middle",
      needsBackdrop: chosen.score > BACKDROP_THRESHOLD,
    });
    live.push({ kind: "label", rect: chosen.rect });
  }

  return placed;
}
