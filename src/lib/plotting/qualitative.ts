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

/** Готовая функция формы кривой по опорным точкам. */
export function qualitativeEvaluator(rawAnchors: Anchor[]): (x: number) => number {
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
  return (x) => {
    if (x <= anchors[0].x) {
      const slope = derivatives[0];
      return anchors[0].y + slope * (x - anchors[0].x);
    }
    const last = anchors.length - 1;
    if (x >= anchors[last].x) {
      return anchors[last].y + derivatives[last] * (x - anchors[last].x);
    }
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
}
