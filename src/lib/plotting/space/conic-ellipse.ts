/** Коэффициенты коники: A x² + B xy + C y² + D x + E y + F = 0 */
export interface ConicCoeffs {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
}

/** Эллипс, полученный из коники: (cx,cy) + R(ψ)·(a cos θ, b sin θ). */
export interface ConicEllipse {
  cx: number;
  cy: number;
  /** Большая полуось. */
  a: number;
  /** Малая полуось. */
  b: number;
  /** Угол большой оси от горизонтали, рад. */
  psi: number;
  /** Параметры θ вершин A, B, D при yaw=0. */
  thetaA: number;
  thetaB: number;
  thetaD: number;
}

export type Point2 = { x: number; y: number };

function solve5x5(m: number[][], b: number[]): number[] | null {
  const n = 5;
  const a = m.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    }
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const div = a[col]![col]!;
    for (let j = col; j <= n; j += 1) a[col]![j]! /= div;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row]![col]!;
      for (let j = col; j <= n; j += 1) a[row]![j]! -= factor * a[col]![j]!;
    }
  }
  return a.map((row) => row[n]!);
}

/** Коника через 5 точек (F = 1). */
export function fitConicFrom5Points(points: Point2[]): ConicCoeffs | null {
  if (points.length < 5) return null;
  const m = points.slice(0, 5).map(({ x, y }) => [x * x, x * y, y * y, x, y]);
  const rhs = [-1, -1, -1, -1, -1];
  const sol = solve5x5(m, rhs);
  if (!sol) return null;
  return { A: sol[0]!, B: sol[1]!, C: sol[2]!, D: sol[3]!, E: sol[4]!, F: 1 };
}

export function conicDiscriminant(c: ConicCoeffs): number {
  return c.B * c.B - 4 * c.A * c.C;
}

/** true, если коника — эллипс (вещественный). */
export function isEllipseConic(c: ConicCoeffs): boolean {
  const disc = conicDiscriminant(c);
  if (disc >= -1e-10) return false;
  const detQ = c.A * c.C - (c.B / 2) * (c.B / 2);
  return detQ > 1e-12;
}

/** Коника → параметры эллипса; null, если не эллипс. */
export function conicToEllipse(c: ConicCoeffs): Omit<ConicEllipse, "thetaA" | "thetaB" | "thetaD"> | null {
  if (!isEllipseConic(c)) return null;
  const { A, B, C, D, E, F } = c;
  const denom = B * B - 4 * A * C;
  const cx = (2 * C * D - B * E) / denom;
  const cy = (2 * A * E - B * D) / denom;

  const F0 = A * cx * cx + B * cx * cy + C * cy * cy + D * cx + E * cy + F;
  if (F0 >= -1e-10) return null;

  const ap = A;
  const bp = B / 2;
  const cp = C;
  const trace = ap + cp;
  const detM = ap * cp - bp * bp;
  const half = trace / 2;
  const rad = Math.sqrt(Math.max(0, half * half - detM));
  let lam1 = half + rad;
  let lam2 = half - rad;
  if (lam1 < lam2) [lam1, lam2] = [lam2, lam1];

  let a = Math.sqrt(-F0 / lam1);
  let b = Math.sqrt(-F0 / lam2);
  let psi = Math.abs(bp) > 1e-12 ? Math.atan2(lam1 - ap, bp) : ap <= cp ? 0 : Math.PI / 2;

  if (a < b) {
    [a, b] = [b, a];
    psi += Math.PI / 2;
  }

  while (psi > Math.PI / 2) psi -= Math.PI;
  while (psi < -Math.PI / 2) psi += Math.PI;

  return { cx, cy, a, b, psi };
}

export function ellipsePoint(e: Pick<ConicEllipse, "cx" | "cy" | "a" | "b" | "psi">, theta: number): Point2 {
  const ct = Math.cos(e.psi);
  const st = Math.sin(e.psi);
  const ex = e.a * Math.cos(theta);
  const ey = e.b * Math.sin(theta);
  return {
    x: e.cx + ct * ex - st * ey,
    y: e.cy + st * ex + ct * ey,
  };
}

/** Угол θ на эллипсе для точки p. */
export function ellipseAngleForPoint(
  e: Pick<ConicEllipse, "cx" | "cy" | "a" | "b" | "psi">,
  p: Point2,
): number {
  const ct = Math.cos(e.psi);
  const st = Math.sin(e.psi);
  const dx = p.x - e.cx;
  const dy = p.y - e.cy;
  const ux = ct * dx + st * dy;
  const uy = -st * dx + ct * dy;
  return Math.atan2(uy / e.b, ux / e.a);
}

/** Исходное основание: A=(0,0), D=(ad,0), B=(kx,ky), C=(ad+kx,ky). */
export function initialBaseCorners(
  kx: number,
  ky: number,
  adLen: number,
): { a: Point2; b: Point2; c: Point2; d: Point2; center: Point2 } {
  return {
    a: { x: 0, y: 0 },
    b: { x: kx, y: ky },
    c: { x: adLen + kx, y: ky },
    d: { x: adLen, y: 0 },
    center: { x: (adLen + kx) / 2, y: ky / 2 },
  };
}

const FIFTH_POINT_X_CANDIDATES = [-0.15, -0.25, -0.35, -0.5, -0.65, -0.85, -1.1];

/**
 * Эллипс через 4 вершины основания + 5-я точка на горизонтали через центр (слева).
 */
export function buildRotationEllipse(
  kx: number,
  ky: number,
  adLen: number,
): ConicEllipse | null {
  const { a, b, c, d, center } = initialBaseCorners(kx, ky, adLen);

  for (const x5 of FIFTH_POINT_X_CANDIDATES) {
    const p5: Point2 = { x: x5, y: center.y };
    const conic = fitConicFrom5Points([a, b, c, d, p5]);
    if (!conic || !isEllipseConic(conic)) continue;
    const base = conicToEllipse(conic);
    if (!base) continue;

    const thetaA = ellipseAngleForPoint(base, a);
    const thetaB = ellipseAngleForPoint(base, b);
    const thetaD = ellipseAngleForPoint(base, d);

    const checkA = ellipsePoint(base, thetaA);
    if (Math.hypot(checkA.x - a.x, checkA.y - a.y) > 0.05) continue;

    return { ...base, thetaA, thetaB, thetaD };
  }
  return null;
}

export function sampleConicEllipse(e: ConicEllipse, segments = 64): Point2[] {
  const pts: Point2[] = [];
  for (let i = 0; i <= segments; i += 1) {
    pts.push(ellipsePoint(e, (i / segments) * Math.PI * 2));
  }
  return pts;
}
