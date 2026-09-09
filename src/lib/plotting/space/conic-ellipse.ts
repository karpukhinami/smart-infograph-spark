/** Эллипс: (cx,cy) + R(ψ)·(a cos θ, b sin θ). Центр = центр параллелограмма. */
export interface ConicEllipse {
  cx: number;
  cy: number;
  /** Большая полуось. */
  a: number;
  /** Малая полуось. */
  b: number;
  /** Угол большой оси от горизонтали, рад. */
  psi: number;
  /** Параметры θ вершин A, B, D при yaw=0; C = θ_A + π, D = θ_B + π. */
  thetaA: number;
  thetaB: number;
  thetaD: number;
}

export type Point2 = { x: number; y: number };

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

function toLocal(p: Point2, center: Point2, psi: number): Point2 {
  const px = p.x - center.x;
  const py = p.y - center.y;
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  return { x: c * px + s * py, y: -s * px + c * py };
}

/** (u/a)² + (v/b)² = 1 по двум точкам в локальных координатах. */
function semiAxesFromTwoLocal(p1: Point2, p2: Point2): { a: number; b: number } | null {
  const det = p1.x * p1.x * p2.y * p2.y - p2.x * p2.x * p1.y * p1.y;
  if (Math.abs(det) < 1e-14) return null;
  const invA2 = (p2.y * p2.y - p1.y * p1.y) / det;
  const invB2 = (p1.x * p1.x - p2.x * p2.x) / det;
  if (invA2 <= 1e-12 || invB2 <= 1e-12) return null;
  return { a: Math.sqrt(1 / invA2), b: Math.sqrt(1 / invB2) };
}

function onEllipse(local: Point2, a: number, b: number, tol = 0.02): boolean {
  const v = (local.x / a) ** 2 + (local.y / b) ** 2;
  return Math.abs(v - 1) <= tol;
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

/** 5-я точка: на горизонтали через центр, слева от A (для формы эллипса). */
function fifthPointCandidates(adLen: number): number[] {
  return [
    -0.02 * adLen,
    -0.08 * adLen,
    -0.15 * adLen,
    -0.25 * adLen,
    -0.4 * adLen,
    -0.6 * adLen,
  ];
}

/**
 * Эллипс с центром в O (центр параллелограмма), проходящий через A, B и P5.
 * Тогда C = 2O−A и D = 2O−B автоматически на эллипсе.
 */
export function buildRotationEllipse(
  kx: number,
  ky: number,
  adLen: number,
): ConicEllipse | null {
  const { a, b, c, d, center } = initialBaseCorners(kx, ky, adLen);

  for (const x5 of fifthPointCandidates(adLen)) {
    const p5: Point2 = { x: x5, y: center.y };
    const orbit = fitCenteredEllipseThroughThreePoints(center, a, b, p5);
    if (!orbit) continue;

    const checkD = ellipsePoint(orbit, orbit.thetaD);
    const checkC = ellipsePoint(orbit, orbit.thetaA + Math.PI);
    if (
      Math.hypot(checkD.x - d.x, checkD.y - d.y) > 0.02 ||
      Math.hypot(checkC.x - c.x, checkC.y - c.y) > 0.02
    ) {
      continue;
    }
    return orbit;
  }
  return null;
}

function fitCenteredEllipseThroughThreePoints(
  center: Point2,
  pA: Point2,
  pB: Point2,
  p5: Point2,
): ConicEllipse | null {
  const steps = 720;
  for (let i = 0; i <= steps; i += 1) {
    const psi = (i / steps) * Math.PI - Math.PI / 2;
    const la = toLocal(pA, center, psi);
    const lb = toLocal(pB, center, psi);
    const axes = semiAxesFromTwoLocal(la, lb);
    if (!axes) continue;

    const l5 = toLocal(p5, center, psi);
    if (!onEllipse(l5, axes.a, axes.b, 0.015)) continue;

    const base = { cx: center.x, cy: center.y, a: axes.a, b: axes.b, psi };
    const thetaA = ellipseAngleForPoint(base, pA);
    const thetaB = ellipseAngleForPoint(base, pB);
    const thetaD = thetaB + Math.PI;

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

/** Проверка: все 4 вершины основания на эллипсе (для отладки). */
export function verifyBaseOnEllipse(
  orbit: ConicEllipse,
  kx: number,
  ky: number,
  adLen: number,
): boolean {
  const { a, b, c, d } = initialBaseCorners(kx, ky, adLen);
  const corners = [
    { p: a, theta: orbit.thetaA },
    { p: b, theta: orbit.thetaB },
    { p: d, theta: orbit.thetaD },
    { p: c, theta: orbit.thetaA + Math.PI },
  ];
  return corners.every(({ p, theta }) => {
    const q = ellipsePoint(orbit, theta);
    return Math.hypot(q.x - p.x, q.y - p.y) < 0.02;
  });
}
