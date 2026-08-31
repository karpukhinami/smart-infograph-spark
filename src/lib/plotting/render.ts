/**
 * SVG-рисовальщик координатной плоскости.
 *
 * Получает только данные сцены (никакого UI-состояния) и возвращает строку SVG.
 * Математическая область построения и физическое полотно разделены: вокруг
 * математической области есть техническое пустое пространство, поэтому стрелки,
 * толстые линии и крайние подписи никогда не обрезаются, а сетка существует
 * только внутри математической области.
 */
import { displayNumber, evaluateNumber, parseValueList } from "./math-expr";
import { firstStepValue, niceStep, tickValues } from "./ticks";
import type { AxisSpec, PlotScene, RenderCurve, RenderPoint } from "./types";

export interface PlotGeometry {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xStep: number;
  yStep: number;
  gridStepX: number;
  gridStepY: number;
  /** Прямоугольник математической области в пикселях. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Технические поля полотна. */
  canvasLeft: number;
  canvasRight: number;
  canvasTop: number;
  canvasBottom: number;
  /** Начала и кончики стрелок осей. */
  axisStartX: number;
  axisStartY: number;
  axisEndX: number;
  axisEndY: number;

  sx: (value: number) => number;
  sy: (value: number) => number;
  xAxisY: number;
  yAxisX: number;
}

function axisNumber(raw: string): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    const value = evaluateNumber(text);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function axisStep(axis: AxisSpec, min: number, max: number): number {
  if (!axis.stepAuto && axis.step.trim()) {
    try {
      const value = evaluateNumber(axis.step);
      if (Number.isFinite(value) && value > 0) return value;
    } catch {
      /* падаем на автоматический шаг */
    }
  }
  return niceStep(min, max);
}

/** Геометрия сцены или null, если четыре предела ещё не заданы. */
export function resolveGeometry(scene: PlotScene): PlotGeometry | null {
  const rawXMin = axisNumber(scene.xAxis.min);
  const rawXMax = axisNumber(scene.xAxis.max);
  const rawYMin = axisNumber(scene.yAxis.min);
  const rawYMax = axisNumber(scene.yAxis.max);
  if (rawXMin === null || rawXMax === null || rawYMin === null || rawYMax === null) return null;
  const xMin = scene.xAxis.mode === "positive" ? Math.max(0, rawXMin) : rawXMin;
  const yMin = scene.yAxis.mode === "positive" ? Math.max(0, rawYMin) : rawYMin;
  const xMax = rawXMax;
  const yMax = rawYMax;
  if (!(xMax > xMin) || !(yMax > yMin)) return null;

  const appearance = scene.appearance;
  const pad = Math.max(0, appearance.padding);

  // Математическая область = внутренний прямоугольник полотна (как в TikZ-прототипе):
  // рамка, сетка и оси используют ровно эти границы.
  let left = pad;
  let right = appearance.width - pad;
  let top = pad;
  let bottom = appearance.height - pad;

  // Равный масштаб по обеим осям: клетки сетки квадратные, сцена остаётся по центру.
  if (appearance.equalScale !== false) {
    const scale = Math.min((right - left) / (xMax - xMin), (bottom - top) / (yMax - yMin));
    const newWidth = scale * (xMax - xMin);
    const newHeight = scale * (yMax - yMin);
    const slackX = (right - left - newWidth) / 2;
    const slackY = (bottom - top - newHeight) / 2;
    left += slackX;
    right = left + newWidth;
    top += slackY;
    bottom = top + newHeight;
  }

  const sx = (value: number) => left + ((value - xMin) / (xMax - xMin)) * (right - left);
  const sy = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top);

  const xStep = axisStep(scene.xAxis, xMin, xMax);
  const yStep = axisStep(scene.yAxis, yMin, yMax);
  const gridStepX = scene.grid.followAxisStep ? xStep : axisNumber(scene.grid.stepX) ?? xStep;
  const gridStepY = scene.grid.followAxisStep ? yStep : axisNumber(scene.grid.stepY) ?? yStep;

  // Ось остаётся видимой, даже если ноль вне диапазона.
  const xAxisY = sy(Math.min(Math.max(0, yMin), yMax));
  const yAxisX = sx(Math.min(Math.max(0, xMin), xMax));

  return {
    xMin, xMax, yMin, yMax, xStep, yStep, gridStepX, gridStepY,
    left, right, top, bottom,
    canvasLeft: left, canvasRight: right, canvasTop: top, canvasBottom: bottom,
    // Оси идут от края области до края: кончик стрелки лежит на границе.
    axisStartX: left,
    axisStartY: bottom,
    axisEndX: right,
    axisEndY: top,
    sx, sy, xAxisY, yAxisX,
  };
}


function escapeText(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function round(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** Значения засечек оси согласно выбранному правилу. */
export function markValues(axis: AxisSpec, min: number, max: number, step: number): number[] {
  switch (axis.markRule) {
    case "zeroOnly":
      return min <= 0 && max >= 0 ? [0] : [];
    case "zeroAndFirst": {
      const values: number[] = [];
      if (min <= 0 && max >= 0) values.push(0);
      const first = firstStepValue(min, max, step);
      if (first !== null && Math.abs(first) > 1e-12) values.push(first);
      return values;
    }
    case "selected":
      try {
        return parseValueList(axis.selectedMarks).filter((value) => value >= min && value <= max);
      } catch {
        return [];
      }
    case "all":
    default:
      return tickValues(min, max, step);
  }
}

export function axisLabelText(axis: AxisSpec): string {
  const name = axis.name.trim() || "x";
  return axis.unit.trim() ? `${name}, ${axis.unit.trim()}` : name;
}

/** Основной рендер: сцена → SVG. */
export function renderPlotSvg(
  scene: PlotScene,
  curves: RenderCurve[],
  points: RenderPoint[],
): string | null {
  const geometry = resolveGeometry(scene);
  if (!geometry) return null;
  const a = scene.appearance;
  const parts: string[] = [];
  const clipId = "plot-math-area";

  parts.push(
    `<defs><clipPath id="${clipId}"><rect x="${round(geometry.left)}" y="${round(geometry.top)}" width="${round(
      geometry.right - geometry.left,
    )}" height="${round(geometry.bottom - geometry.top)}"/></clipPath></defs>`,
  );

  // Сетка — по всей математической области (как в TikZ-прототипе).
  if (scene.grid.visible) {
    const vertical = tickValues(geometry.xMin, geometry.xMax, geometry.gridStepX);
    const horizontal = tickValues(geometry.yMin, geometry.yMax, geometry.gridStepY);
    const lines: string[] = [];
    for (const value of vertical) {
      const x = geometry.sx(value);
      lines.push(
        `<line x1="${round(x)}" y1="${round(geometry.top)}" x2="${round(x)}" y2="${round(geometry.bottom)}"/>`,
      );
    }
    for (const value of horizontal) {
      const y = geometry.sy(value);
      lines.push(
        `<line x1="${round(geometry.left)}" y1="${round(y)}" x2="${round(geometry.right)}" y2="${round(y)}"/>`,
      );
    }
    parts.push(
      `<g stroke="${a.gridColor}" stroke-width="${a.gridWidth}" fill="none">${lines.join("")}</g>`,
    );
  }

  // Оси со стрелками: от края области до края, кончик стрелки лежит на границе.
  const arrow = a.arrowSize;
  const arrowHalf = arrow * 0.45;
  const axisStyle = `stroke="${a.axisColor}" stroke-width="${a.axisWidth}" stroke-linecap="round"`;
  const xStart = geometry.axisStartX;
  const xEnd = geometry.axisEndX;
  const yStart = geometry.axisStartY;
  const yEnd = geometry.axisEndY;

  parts.push(
    `<line x1="${round(xStart)}" y1="${round(geometry.xAxisY)}" x2="${round(xEnd - arrow)}" y2="${round(geometry.xAxisY)}" ${axisStyle}/>`,
    `<polygon points="${round(xEnd)},${round(geometry.xAxisY)} ${round(xEnd - arrow)},${round(
      geometry.xAxisY - arrowHalf,
    )} ${round(xEnd - arrow)},${round(geometry.xAxisY + arrowHalf)}" fill="${a.axisColor}"/>`,
    `<line x1="${round(geometry.yAxisX)}" y1="${round(yStart)}" x2="${round(geometry.yAxisX)}" y2="${round(yEnd + arrow)}" ${axisStyle}/>`,
    `<polygon points="${round(geometry.yAxisX)},${round(yEnd)} ${round(geometry.yAxisX - arrowHalf)},${round(
      yEnd + arrow,
    )} ${round(geometry.yAxisX + arrowHalf)},${round(yEnd + arrow)}" fill="${a.axisColor}"/>`,
  );


  // Засечки и подписи.
  const labelStyle = `font-family="${escapeText(a.labelFontFamily)}" font-size="${a.labelFontSize}" fill="${a.labelColor}"`;
  const tickStyle = `stroke="${a.axisColor}" stroke-width="${a.tickWidth}"`;
  const xMarks = markValues(scene.xAxis, geometry.xMin, geometry.xMax, geometry.xStep);
  const yMarks = markValues(scene.yAxis, geometry.yMin, geometry.yMax, geometry.yStep);
  const ticks: string[] = [];
  const labels: string[] = [];
  for (const value of xMarks) {
    const x = geometry.sx(value);
    const isZero = Math.abs(value) < 1e-12;
    if (!isZero) {
      ticks.push(
        `<line x1="${round(x)}" y1="${round(geometry.xAxisY - a.tickSize)}" x2="${round(x)}" y2="${round(
          geometry.xAxisY + a.tickSize,
        )}" ${tickStyle}/>`,
      );
    }
    const text = displayNumber(value, scene.xAxis.labelFormat);
    const offsetX = isZero ? x - a.labelFontSize * 0.5 : x;
    labels.push(
      `<text x="${round(offsetX)}" y="${round(geometry.xAxisY + a.tickSize + a.labelFontSize)}" text-anchor="${
        isZero ? "end" : "middle"
      }" ${labelStyle}>${escapeText(text)}</text>`,
    );
  }
  for (const value of yMarks) {
    const isZero = Math.abs(value) < 1e-12;
    if (isZero && xMarks.some((mark) => Math.abs(mark) < 1e-12)) continue;
    const y = geometry.sy(value);
    if (!isZero) {
      ticks.push(
        `<line x1="${round(geometry.yAxisX - a.tickSize)}" y1="${round(y)}" x2="${round(
          geometry.yAxisX + a.tickSize,
        )}" y2="${round(y)}" ${tickStyle}/>`,
      );
    }
    const text = displayNumber(value, scene.yAxis.labelFormat);
    labels.push(
      `<text x="${round(geometry.yAxisX - a.tickSize - 4)}" y="${round(y + a.labelFontSize * 0.35)}" text-anchor="end" ${labelStyle}>${escapeText(
        text,
      )}</text>`,
    );
  }
  parts.push(ticks.join(""), labels.join(""));

  // Названия осей: горизонтальная — снизу, вертикальная — слева.
  parts.push(
    `<text x="${round(xEnd)}" y="${round(Math.min(geometry.xAxisY + a.labelFontSize * 2.4, a.height - 4))}" text-anchor="end" font-style="italic" ${labelStyle}>${escapeText(
      axisLabelText(scene.xAxis),
    )}</text>`,
    `<text x="${round(Math.max(geometry.yAxisX - a.labelFontSize * 2.2, a.labelFontSize * 0.6))}" y="${round(
      yEnd + a.labelFontSize,
    )}" text-anchor="start" font-style="italic" ${labelStyle}>${escapeText(axisLabelText(scene.yAxis))}</text>`,
  );

  // Графики (клипуются по математической области).
  const curveParts: string[] = [];
  for (const curve of curves) {
    for (const segment of curve.segments) {
      if (segment.length < 2) continue;
      const d = segment
        .map(([x, y], index) => `${index === 0 ? "M" : "L"}${round(geometry.sx(x))} ${round(geometry.sy(y))}`)
        .join(" ");
      curveParts.push(
        `<path d="${d}" fill="none" stroke="${curve.color}" stroke-width="${curve.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
  }
  parts.push(`<g clip-path="url(#${clipId})">${curveParts.join("")}</g>`);

  // Точки, их подписи и проекции на оси.
  const pointParts: string[] = [];
  for (const point of points) {
    const px = geometry.sx(point.x);
    const py = geometry.sy(point.y);
    if (point.projectX) {
      pointParts.push(
        `<line x1="${round(px)}" y1="${round(py)}" x2="${round(px)}" y2="${round(geometry.xAxisY)}" stroke="${a.projectionColor}" stroke-width="${a.projectionWidth}" stroke-dasharray="5 4"/>`,
        `<line x1="${round(px)}" y1="${round(geometry.xAxisY - a.tickSize)}" x2="${round(px)}" y2="${round(
          geometry.xAxisY + a.tickSize,
        )}" ${tickStyle}/>`,
      );
      if (point.labelProjectionX) {
        pointParts.push(
          `<text x="${round(px)}" y="${round(geometry.xAxisY + a.tickSize + a.labelFontSize)}" text-anchor="middle" ${labelStyle}>${escapeText(
            point.labelProjectionX,
          )}</text>`,
        );
      }
    }
    if (point.projectY) {
      pointParts.push(
        `<line x1="${round(px)}" y1="${round(py)}" x2="${round(geometry.yAxisX)}" y2="${round(py)}" stroke="${a.projectionColor}" stroke-width="${a.projectionWidth}" stroke-dasharray="5 4"/>`,
        `<line x1="${round(geometry.yAxisX - a.tickSize)}" y1="${round(py)}" x2="${round(
          geometry.yAxisX + a.tickSize,
        )}" y2="${round(py)}" ${tickStyle}/>`,
      );
      if (point.labelProjectionY) {
        pointParts.push(
          `<text x="${round(geometry.yAxisX - a.tickSize - 4)}" y="${round(py - 4)}" text-anchor="end" ${labelStyle}>${escapeText(
            point.labelProjectionY,
          )}</text>`,
        );
      }
    }
    pointParts.push(
      `<circle cx="${round(px)}" cy="${round(py)}" r="${a.pointRadius}" fill="${
        point.open ? "#FFFFFF" : point.color
      }" stroke="${point.color}" stroke-width="${Math.max(1.4, a.pointRadius * 0.5)}"/>`,
    );
    const caption = [point.label, point.coords].filter(Boolean).join(" ");
    if (caption) {
      pointParts.push(
        `<text x="${round(px + a.pointRadius + 4)}" y="${round(py - a.pointRadius - 4)}" font-family="${escapeText(
          a.pointLabelFontFamily,
        )}" font-size="${a.pointLabelFontSize}" fill="${a.labelColor}">${escapeText(caption)}</text>`,
      );
    }
  }
  parts.push(pointParts.join(""));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${a.width}" height="${a.height}" viewBox="0 0 ${a.width} ${a.height}"><rect width="${a.width}" height="${a.height}" fill="#FFFFFF"/>${parts.join(
    "",
  )}</svg>`;
}
