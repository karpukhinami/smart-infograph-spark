/**
 * Качественный график по опорным точкам.
 *
 * Между точками используется кубическая интерполяция Эрмита. Производная в
 * точке-экстремуме равна нулю, в обычных точках — монотонная (Фрич–Карлсон),
 * что не создаёт «случайных» лишних максимумов и минимумов.
 */
import type { AnchorKind } from "./types";

export interface Anchor {
  x: number;
  y: number;
  kind: AnchorKind;
}

function tangents(anchors: Anchor[]): number[] {
  const n = anchors.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = anchors[i + 1].x - anchors[i].x;
    slopes.push(dx === 0 ? 0 : (anchors[i + 1].y - anchors[i].y) / dx);
  }
  const derivatives = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (anchors[i].kind !== "plain") {
      derivatives[i] = 0;
      continue;
    }
    if (i === 0) derivatives[i] = slopes[0] ?? 0;
    else if (i === n - 1) derivatives[i] = slopes[n - 2] ?? 0;
    else {
      const a = slopes[i - 1];
      const b = slopes[i];
      derivatives[i] = a * b <= 0 ? 0 : (a + b) / 2;
    }
  }
  // Ограничение производных, чтобы не появлялось перерегулирование.
  for (let i = 0; i < n - 1; i++) {
    const slope = slopes[i];
    if (slope === 0) {
      derivatives[i] = 0;
      derivatives[i + 1] = 0;
      continue;
    }
    const alpha = derivatives[i] / slope;
    const beta = derivatives[i + 1] / slope;
    const limit = 3;
    if (alpha > limit) derivatives[i] = limit * slope;
    if (beta > limit) derivatives[i + 1] = limit * slope;
    if (alpha < 0) derivatives[i] = 0;
    if (beta < 0) derivatives[i + 1] = 0;
  }
  return derivatives;
}

function hermite(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  m0: number,
  m1: number,
): number {
  const h = x1 - x0;
  if (h === 0) return y0;
  const t = (x - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * y0 +
    (t3 - 2 * t2 + t) * h * m0 +
    (-2 * t3 + 3 * t2) * y1 +
    (t3 - t2) * h * m1
  );
}

/**
 * Готовая функция формы кривой по опорным точкам.
 *
 * `extend: "curve"` (по умолчанию) продолжает кривую за крайними опорными
 * точками гладко: сохраняется не только наклон, но и кривизна крайнего участка,
 * поэтому за точкой-экстремумом кривая не превращается в горизонтальный луч.
 * `extend: "linear"` — прямолинейное продолжение по касательной.
 */
export function qualitativeEvaluator(
  rawAnchors: Anchor[],
  extend: "curve" | "linear" = "curve",
): (x: number) => number {
  const anchors = [...rawAnchors].sort((a, b) => a.x - b.x);
  if (anchors.length < 2) throw new Error("Нужно минимум 2 опорные точки.");
  const onlyPlainPair =
    anchors.length === 2 && anchors.every((anchor) => anchor.kind === "plain");
  if (onlyPlainPair) {
    const [a, b] = anchors;
    const slope = b.x === a.x ? 0 : (b.y - a.y) / (b.x - a.x);
    return (x) => a.y + slope * (x - a.x);
  }
  const derivatives = tangents(anchors);
  const last = anchors.length - 1;

  const inner = (x: number): number => {
    let i = 0;
    while (i < last && x > anchors[i + 1].x) i++;
    return hermite(
      x,
      anchors[i].x,
      anchors[i + 1].x,
      anchors[i].y,
      anchors[i + 1].y,
      derivatives[i],
      derivatives[i + 1],
    );
  };

  /** Вторая производная крайнего участка в его конце (численно). */
  function curvatureAt(index: number): number {
    const neighbour = index === 0 ? 1 : last - 1;
    const h = Math.abs(anchors[neighbour].x - anchors[index].x) / 20 || 1e-3;
    const x0 = anchors[index].x;
    const sign = index === 0 ? 1 : -1;
    const f0 = anchors[index].y;
    const f1 = inner(x0 + sign * h);
    const f2 = inner(x0 + sign * 2 * h);
    return (f2 - 2 * f1 + f0) / (h * h);
  }

  const curvatureStart = extend === "curve" ? curvatureAt(0) : 0;
  const curvatureEnd = extend === "curve" ? curvatureAt(last) : 0;

  return (x) => {
    if (x <= anchors[0].x) {
      const dx = x - anchors[0].x;
      return anchors[0].y + derivatives[0] * dx + 0.5 * curvatureStart * dx * dx;
    }
    if (x >= anchors[last].x) {
      const dx = x - anchors[last].x;
      return anchors[last].y + derivatives[last] * dx + 0.5 * curvatureEnd * dx * dx;
    }
    return inner(x);
  };
}
