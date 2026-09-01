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
import {
  layoutLabels,
  measureTextWidth,
  type LabelRequest,
  type Obstacle,
  type PlacedLabel,
  type Rect,
} from "./label-layout";
import { firstStepValue, niceStep, tickValues } from "./ticks";
import type { AxisSpec, PlotAppearance, PlotScene, RenderCurve, RenderPoint } from "./types";

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
  /** Итоговый размер картинки (может быть прямоугольным). */
  canvasWidth: number;
  canvasHeight: number;
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
  const font = appearance.labelFontSize;

  const xStep = axisStep(scene.xAxis, xMin, xMax);
  const yStep = axisStep(scene.yAxis, yMin, yMax);
  const gridStepX = scene.grid.followAxisStep ? xStep : axisNumber(scene.grid.stepX) ?? xStep;
  const gridStepY = scene.grid.followAxisStep ? yStep : axisNumber(scene.grid.stepY) ?? yStep;

  // Если ноль не попал внутрь диапазона, ось ложится на рамку, а её подписи
  // уходят за пределы области — под них нужен запас с «воздухом».
  const yLabels = markValues(scene.yAxis, yMin, yMax, yStep)
    .map((value) => displayNumber(value, scene.yAxis.labelFormat).length);
  const maxYLabel = yLabels.length ? Math.max(...yLabels) : 1;
  const yGutter = appearance.tickSize + 7 + maxYLabel * font * 0.58 + 10;
  const xGutter = appearance.tickSize + font + 3 + 10;

  const padLeft = pad + (xMin >= 0 ? yGutter : 0);
  const padRight = pad + (xMax <= 0 ? yGutter : 0);
  const padTop = pad + (yMax <= 0 ? xGutter : 0);
  const padBottom = pad + (yMin >= 0 ? xGutter : 0);

  // Сетка всегда квадратная: масштаб один для обеих осей, более длинная ось
  // занимает всё доступное место, а картинка становится прямоугольной.
  const availWidth = Math.max(10, appearance.width - padLeft - padRight);
  const availHeight = Math.max(10, appearance.height - padTop - padBottom);
  const scale = Math.min(availWidth / (xMax - xMin), availHeight / (yMax - yMin));
  const areaWidth = scale * (xMax - xMin);
  const areaHeight = scale * (yMax - yMin);

  const left = padLeft;
  const right = left + areaWidth;
  const top = padTop;
  const bottom = top + areaHeight;
  const canvasWidth = padLeft + areaWidth + padRight;
  const canvasHeight = padTop + areaHeight + padBottom;

  const sx = (value: number) => left + ((value - xMin) / (xMax - xMin)) * (right - left);
  const sy = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top);

  // Ось остаётся видимой, даже если ноль вне диапазона.
  const xAxisY = sy(Math.min(Math.max(0, yMin), yMax));
  const yAxisX = sx(Math.min(Math.max(0, xMin), xMax));

  return {
    xMin, xMax, yMin, yMax, xStep, yStep, gridStepX, gridStepY,
    left, right, top, bottom,
    canvasLeft: left, canvasRight: right, canvasTop: top, canvasBottom: bottom,
    canvasWidth, canvasHeight,
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
    default: {
      // Крайние засечки не ставим: у самой рамки не должно быть ни штриха, ни подписи.
      const edge = (max - min) * 1e-6;
      const values = tickValues(min, max, step).filter(
        (value) => value > min + edge && value < max - edge,
      );
      return values;
    }
  }
}

export function axisLabelText(axis: AxisSpec): string {
  const name = axis.name.trim() || "x";
  return axis.unit.trim() ? `${name}, ${axis.unit.trim()}` : name;
}

const BACKDROP_PAD = 3;

/** Прямоугольник текстовой подписи по якорю и text-anchor. */
function textBoundingRect(
  x: number,
  y: number,
  text: string,
  fontSize: number,
  anchor: "start" | "middle" | "end",
  baselineShift = fontSize * 0.35,
): Rect {
  const width = measureTextWidth(text, fontSize);
  const height = fontSize * 1.12;
  let left = x;
  if (anchor === "middle") left = x - width / 2;
  else if (anchor === "end") left = x - width;
  const top = y - baselineShift - fontSize * 0.78;
  return { x: left, y: top, width, height };
}

function pointCaptionText(point: RenderPoint): string {
  const parts: string[] = [];
  if (point.label) parts.push(point.label);
  if (point.coords) parts.push(point.coords);
  return parts.join(" ");
}

function pointMarkerRect(px: number, py: number, radius: number): Rect {
  const size = radius * 2 + 4;
  return { x: px - size / 2, y: py - size / 2, width: size, height: size };
}

/** Препятствия для автораскладки подписей точек (без самих подписей точек). */
function buildLabelObstacles(
  geometry: PlotGeometry,
  scene: PlotScene,
  curves: RenderCurve[],
  points: RenderPoint[],
  a: PlotAppearance,
  xMarks: number[],
  yMarks: number[],
): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const arrow = a.arrowSize;

  obstacles.push({
    kind: "axis",
    points: [
      [geometry.axisStartX, geometry.xAxisY],
      [geometry.axisEndX - arrow, geometry.xAxisY],
    ],
  });
  obstacles.push({
    kind: "axis",
    points: [
      [geometry.yAxisX, geometry.axisStartY],
      [geometry.yAxisX, geometry.axisEndY + arrow],
    ],
  });

  for (const value of xMarks) {
    const x = geometry.sx(value);
    const isZero = Math.abs(value) < 1e-12;
    const text = displayNumber(value, scene.xAxis.labelFormat);
    const offsetX = isZero ? x - a.tickSize - 7 : x;
    const baseline = geometry.xAxisY + a.tickSize + a.labelFontSize + 3;
    obstacles.push({
      kind: "axisLabel",
      rect: textBoundingRect(offsetX, baseline, text, a.labelFontSize, isZero ? "end" : "middle"),
    });
  }

  for (const value of yMarks) {
    const isZero = Math.abs(value) < 1e-12;
    if (isZero && xMarks.some((mark) => Math.abs(mark) < 1e-12)) continue;
    const y = geometry.sy(value);
    const text = displayNumber(value, scene.yAxis.labelFormat);
    obstacles.push({
      kind: "axisLabel",
      rect: textBoundingRect(
        geometry.yAxisX - a.tickSize - 7,
        y + a.labelFontSize * 0.35,
        text,
        a.labelFontSize,
        "end",
      ),
    });
  }

  const xNameY = Math.min(geometry.canvasHeight - 4, geometry.xAxisY + a.labelFontSize + 4);
  const yNameRaw = geometry.yAxisX - 12;
  const yNameX = yNameRaw < a.labelFontSize * 0.6 ? geometry.yAxisX + 12 : yNameRaw;
  const yNameAnchor = yNameRaw < a.labelFontSize * 0.6 ? "start" : "end";
  obstacles.push({
    kind: "axisLabel",
    rect: textBoundingRect(
      geometry.axisEndX - 10,
      xNameY,
      axisLabelText(scene.xAxis),
      a.labelFontSize,
      "end",
    ),
  });
  obstacles.push({
    kind: "axisLabel",
    rect: textBoundingRect(
      yNameX,
      geometry.axisEndY + a.labelFontSize + 4,
      axisLabelText(scene.yAxis),
      a.labelFontSize,
      yNameAnchor,
    ),
  });

  for (const curve of curves) {
    for (const segment of curve.segments) {
      if (segment.length < 2) continue;
      obstacles.push({
        kind: "curve",
        points: segment.map(([x, y]) => [geometry.sx(x), geometry.sy(y)] as [number, number]),
      });
    }
  }

  for (const point of points) {
    const px = geometry.sx(point.x);
    const py = geometry.sy(point.y);
    obstacles.push({ kind: "point", rect: pointMarkerRect(px, py, a.pointRadius) });

    if (point.projectX) {
      obstacles.push({
        kind: "helper",
        points: [
          [px, py],
          [px, geometry.xAxisY],
        ],
      });
      if (point.labelProjectionX) {
        obstacles.push({
          kind: "helper",
          rect: textBoundingRect(
            px,
            geometry.xAxisY + a.tickSize + a.labelFontSize,
            point.labelProjectionX,
            a.labelFontSize,
            "middle",
          ),
        });
      }
    }

    if (point.projectY) {
      obstacles.push({
        kind: "helper",
        points: [
          [px, py],
          [geometry.yAxisX, py],
        ],
      });
      if (point.labelProjectionY) {
        obstacles.push({
          kind: "helper",
          rect: textBoundingRect(
            geometry.yAxisX - a.tickSize - 4,
            py - 4,
            point.labelProjectionY,
            a.labelFontSize,
            "end",
          ),
        });
      }
    }
  }

  return obstacles;
}

function layoutPointLabels(
  geometry: PlotGeometry,
  scene: PlotScene,
  curves: RenderCurve[],
  points: RenderPoint[],
  a: PlotAppearance,
  xMarks: number[],
  yMarks: number[],
): Map<string, PlacedLabel> {
  const area: Rect = {
    x: geometry.left,
    y: geometry.top,
    width: geometry.right - geometry.left,
    height: geometry.bottom - geometry.top,
  };
  const obstacles = buildLabelObstacles(geometry, scene, curves, points, a, xMarks, yMarks);
  const requests: LabelRequest[] = [];

  for (const point of points) {
    const caption = pointCaptionText(point);
    if (!caption) continue;
    const px = geometry.sx(point.x);
    const py = geometry.sy(point.y);
    const fontSize = a.pointLabelFontSize;
    requests.push({
      id: point.id,
      anchorX: px,
      anchorY: py,
      width: measureTextWidth(caption, fontSize),
      height: fontSize * 1.12,
      gap: a.pointRadius + 8,
      placement: point.labelPlacement ?? "auto",
    });
  }

  return new Map(
    layoutLabels(requests, obstacles, area, { fontSize: a.pointLabelFontSize }).map((item) => [
      item.id,
      item,
    ]),
  );
}

function renderPointCaption(
  point: RenderPoint,
  placed: PlacedLabel,
  a: PlotAppearance,
): string {
  const captionParts: string[] = [];
  if (point.label) captionParts.push(`<tspan font-style="italic">${escapeText(point.label)}</tspan>`);
  if (point.coords) captionParts.push(`<tspan font-style="normal">${escapeText(point.coords)}</tspan>`);
  const textStyle = `font-family="${escapeText(a.pointLabelFontFamily)}" font-size="${a.pointLabelFontSize}" fill="${point.color}"`;
  const backdrop = placed.needsBackdrop
    ? `<rect x="${round(placed.rect.x - BACKDROP_PAD)}" y="${round(placed.rect.y - BACKDROP_PAD)}" width="${round(
        placed.rect.width + BACKDROP_PAD * 2,
      )}" height="${round(placed.rect.height + BACKDROP_PAD * 2)}" fill="#FFFFFF" fill-opacity="0.35" rx="2"/>`
    : "";
  return `${backdrop}<text x="${round(placed.x)}" y="${round(placed.y)}" text-anchor="${placed.textAnchor}" ${textStyle}>${captionParts.join(" ")}</text>`;
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

  // Рамка — по границе математической области, но под осями: если ось лежит
  // на краю (полуось или диапазон без нуля), она должна быть видна поверх рамки.
  if (a.frame) {
    parts.push(
      `<rect x="${round(geometry.left)}" y="${round(geometry.top)}" width="${round(
        geometry.right - geometry.left,
      )}" height="${round(geometry.bottom - geometry.top)}" fill="none" stroke="${a.frameColor}" stroke-width="${a.frameWidth}"/>`,
    );
  }


  // Оси со стрелками: от края области до края, кончик стрелки лежит на границе.
  // Равнобедренный треугольник: высота вдоль оси = arrowSize, основание = 0.45 * высоты
  // (узкая «игла», как на классических учебных чертежах).
  const arrow = a.arrowSize;
  const arrowHalf = arrow * 0.225;
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
  const tickStyle = `stroke="${a.axisColor}" stroke-width="${a.tickWidth}" stroke-linecap="round"`;
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
    // Ноль — снизу-слева от пересечения осей, но на том же удалении от осей,
    // что и остальные подписи (иначе он «липнет» к осям).
    const offsetX = isZero ? x - a.tickSize - 7 : x;
    const baseline = geometry.xAxisY + a.tickSize + a.labelFontSize + 3;
    labels.push(
      `<text x="${round(offsetX)}" y="${round(baseline)}" text-anchor="${
        isZero ? "end" : "middle"
      }" font-style="normal" ${labelStyle}>${escapeText(text)}</text>`,
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
      `<text x="${round(geometry.yAxisX - a.tickSize - 7)}" y="${round(y + a.labelFontSize * 0.35)}" text-anchor="end" font-style="normal" ${labelStyle}>${escapeText(
        text,
      )}</text>`,
    );
  }
  parts.push(ticks.join(""), labels.join(""));

  // Названия осей: подпись x всегда под осью, подпись y всегда слева от оси —
  // даже если ось лежит на краю рамки (тогда они уходят в свободные поля).
  const xNameY = Math.min(
    geometry.canvasHeight - 4,
    geometry.xAxisY + a.labelFontSize + 4,
  );
  const yNameRaw = geometry.yAxisX - 12;
  const yNameX = yNameRaw < a.labelFontSize * 0.6 ? geometry.yAxisX + 12 : yNameRaw;
  const yNameAnchor = yNameRaw < a.labelFontSize * 0.6 ? "start" : "end";

  parts.push(
    `<text x="${round(xEnd - 10)}" y="${round(xNameY)}" text-anchor="end" font-style="italic" ${labelStyle}>${escapeText(
      axisLabelText(scene.xAxis),
    )}</text>`,
    `<text x="${round(yNameX)}" y="${round(yEnd + a.labelFontSize + 4)}" text-anchor="${yNameAnchor}" font-style="italic" ${labelStyle}>${escapeText(
      axisLabelText(scene.yAxis),
    )}</text>`,

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

  const placedLabels = layoutPointLabels(geometry, scene, curves, points, a, xMarks, yMarks);

  // Маркеры точек и проекции — ниже; подписи точек — в верхнем текстовом слое.
  const markerParts: string[] = [];
  const pointLabelParts: string[] = [];
  for (const point of points) {
    const px = geometry.sx(point.x);
    const py = geometry.sy(point.y);
    if (point.projectX) {
      markerParts.push(
        `<line x1="${round(px)}" y1="${round(py)}" x2="${round(px)}" y2="${round(geometry.xAxisY)}" stroke="${a.projectionColor}" stroke-width="${a.projectionWidth}" stroke-dasharray="5 4"/>`,
        `<line x1="${round(px)}" y1="${round(geometry.xAxisY - a.tickSize)}" x2="${round(px)}" y2="${round(
          geometry.xAxisY + a.tickSize,
        )}" ${tickStyle}/>`,
      );
      if (point.labelProjectionX) {
        markerParts.push(
          `<text x="${round(px)}" y="${round(geometry.xAxisY + a.tickSize + a.labelFontSize)}" text-anchor="middle" ${labelStyle}>${escapeText(
            point.labelProjectionX,
          )}</text>`,
        );
      }
    }
    if (point.projectY) {
      markerParts.push(
        `<line x1="${round(px)}" y1="${round(py)}" x2="${round(geometry.yAxisX)}" y2="${round(py)}" stroke="${a.projectionColor}" stroke-width="${a.projectionWidth}" stroke-dasharray="5 4"/>`,
        `<line x1="${round(geometry.yAxisX - a.tickSize)}" y1="${round(py)}" x2="${round(
          geometry.yAxisX + a.tickSize,
        )}" y2="${round(py)}" ${tickStyle}/>`,
      );
      if (point.labelProjectionY) {
        markerParts.push(
          `<text x="${round(geometry.yAxisX - a.tickSize - 4)}" y="${round(py - 4)}" text-anchor="end" ${labelStyle}>${escapeText(
            point.labelProjectionY,
          )}</text>`,
        );
      }
    }
    markerParts.push(
      `<circle cx="${round(px)}" cy="${round(py)}" r="${a.pointRadius}" fill="${
        point.open ? "#FFFFFF" : point.color
      }" stroke="${point.color}" stroke-width="2"/>`,
    );

    const placed = placedLabels.get(point.id);
    if (placed && pointCaptionText(point)) {
      pointLabelParts.push(renderPointCaption(point, placed, a));
    }
  }
  parts.push(markerParts.join(""));
  parts.push(`<g>${pointLabelParts.join("")}</g>`);

  const w = round(geometry.canvasWidth);
  const h = round(geometry.canvasHeight);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#FFFFFF"/>${parts.join(
    "",
  )}</svg>`;

}
