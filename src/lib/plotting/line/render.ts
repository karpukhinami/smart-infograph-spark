/**
 * SVG-рендерер числовой прямой.
 */
import { displayNumber, evaluateNumber } from "../math-expr";
import type { PlotScene } from "../types";
import { majorTickValues, parseSemicolonList, valueOnMajorTick } from "./intervals";
import {
  labelNeedsLatex,
  renderCoordinateLabel,
  renderSvgTextLabel,
} from "./svg-labels";
import type {
  BuiltSetPart,
  LineSceneData,
  LineTickSettings,
  MajorLabelMode,
  SceneLinePoint,
  SceneSet,
} from "./types";

export const LINE_CANVAS_WIDTH = 720;
export const LINE_ROW_HEIGHT = 144;
export const LINE_ROW_GAP = 56;
export const LINE_PADDING = 16;

export interface LineRowGeometry {
  rowIndex: number;
  axisY: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LineGeometry {
  axisMin: number;
  axisMax: number;
  contentMin: number;
  contentMax: number;
  majorStep: number;
  canvasWidth: number;
  canvasHeight: number;
  rows: LineRowGeometry[];
  sx: (value: number) => number;
}

function axisNumber(raw: string): number | null {
  try {
    const value = evaluateNumber(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function resolveLineGeometry(scene: PlotScene): LineGeometry | null {
  const line = scene.line;
  if (!line) return null;
  const min = axisNumber(line.axis.min);
  const max = axisNumber(line.axis.max);
  const step = axisNumber(line.axis.majorStep) ?? 1;
  if (min === null || max === null || !(max > min) || step <= 0) return null;

  const contentMin = min - step / 2;
  const contentMax = max + step / 2;
  const a = scene.appearance;
  const pad = Math.max(LINE_PADDING, a.padding);
  const plotLeft = pad;
  const plotRightCanvas = LINE_CANVAS_WIDTH - pad;
  /** contentMax отображается у основания стрелки, не у её кончика. */
  const plotRightAxis = plotRightCanvas - a.arrowSize;
  const rowCount = Math.max(1, line.axisRowCount);
  const canvasHeight =
    rowCount * LINE_ROW_HEIGHT + Math.max(0, rowCount - 1) * LINE_ROW_GAP + pad * 2;

  const sx = (value: number) =>
    plotLeft + ((value - contentMin) / (contentMax - contentMin)) * (plotRightAxis - plotLeft);

  const rows: LineRowGeometry[] = [];
  for (let i = 0; i < rowCount; i++) {
    const top = pad + i * (LINE_ROW_HEIGHT + LINE_ROW_GAP);
    const bottom = top + LINE_ROW_HEIGHT;
    const axisY = top + LINE_ROW_HEIGHT * 0.62;
    rows.push({ rowIndex: i, axisY, left: plotLeft, right: plotRightCanvas, top, bottom });
  }

  return {
    axisMin: min,
    axisMax: max,
    contentMin,
    contentMax,
    majorStep: step,
    canvasWidth: LINE_CANVAS_WIDTH,
    canvasHeight,
    rows,
    sx,
  };
}

function round(value: number): string {
  return String(Number(value.toFixed(2)));
}

function majorLabels(
  ticks: LineTickSettings,
  values: number[],
  min: number,
  step: number,
): number[] {
  if (!ticks.majorVisible) return [];
  switch (ticks.majorLabelMode as MajorLabelMode) {
    case "firstTwo":
      return values.slice(0, 2);
    case "givenTwo": {
      try {
        const anchor = evaluateNumber(ticks.majorLabelAnchor);
        const idx = values.findIndex((v) => Math.abs(v - anchor) < step * 1e-6);
        if (idx < 0) return [];
        return values.slice(idx, idx + 2);
      } catch {
        return [];
      }
    }
    case "selected":
      try {
        const selected = parseSemicolonList(ticks.majorSelectedLabels);
        return values.filter((v) => selected.some((s) => Math.abs(s - v) < step * 1e-6));
      } catch {
        return [];
      }
    case "none":
      return [];
    case "all":
    default:
      return values;
  }
}

function minorTickValues(min: number, max: number, majorStep: number, divisions: number): number[] {
  if (divisions < 2) return [];
  const minorStep = majorStep / divisions;
  const majors = new Set(majorTickValues(min, max, majorStep).map((v) => Number(v.toPrecision(12))));
  const values: number[] = [];
  let v = min;
  while (v <= max + majorStep * 1e-6) {
    const rounded = Number(v.toPrecision(12));
    if (!majors.has(rounded) && rounded >= min - 1e-9 && rounded <= max + 1e-9) {
      values.push(Math.abs(rounded) < minorStep * 1e-9 ? 0 : rounded);
    }
    v += minorStep;
    if (values.length > 2000) break;
  }
  return values;
}

function minorLabels(
  ticks: LineTickSettings,
  minorValues: number[],
  majorStep: number,
): number[] {
  if (ticks.minorLabelMode === "oneInterval") {
    try {
      const start = evaluateNumber(ticks.minorLabelIntervalStart);
      return minorValues.filter((v) => v >= start - 1e-9 && v < start + majorStep - 1e-9);
    } catch {
      return [];
    }
  }
  return minorValues;
}

function clipInterval(part: BuiltSetPart, visMin: number, visMax: number): { left: number; right: number } | null {
  const left = Math.max(part.left, visMin);
  const right = Math.min(part.right, visMax);
  if (right <= left + 1e-9) {
    if (part.right === Infinity && part.left <= visMax) return { left: Math.max(part.left, visMin), right: visMax };
    if (part.left === -Infinity && part.right >= visMin) return { left: visMin, right: Math.min(part.right, visMax) };
    return null;
  }
  return { left, right };
}

const HATCH_HEIGHT = 20;
const HATCH_GAP = 11;
const HATCH_WIDTH = 2;
const HATCH_ANGLE = 63.435 * (Math.PI / 180);
const ARC_HEIGHT = 40;

function renderHatch(
  x1: number,
  x2: number,
  axisY: number,
  above: boolean,
  slantRight: boolean,
  color: string,
): string {
  const dy = (above ? -1 : 1) * Math.sin(HATCH_ANGLE) * HATCH_HEIGHT;
  const dx = (slantRight ? 1 : -1) * Math.cos(HATCH_ANGLE) * HATCH_HEIGHT;
  const lines: string[] = [];
  if (x2 <= x1 + 0.5) return "";

  const minSegX = (x0: number) => Math.min(x0, x0 + dx);
  const maxSegX = (x0: number) => Math.max(x0, x0 + dx);

  const fits = (x0: number) => {
    const loX = minSegX(x0);
    const hiX = maxSegX(x0);
    return loX >= x1 - 0.01 && hiX <= x2 + 0.01;
  };

  let x0 = slantRight ? x1 : x1 - dx;
  const limit = slantRight ? x2 - dx : x2;
  while (x0 <= limit + 0.01) {
    if (fits(x0)) {
      lines.push(
        `<line x1="${round(x0)}" y1="${round(axisY)}" x2="${round(x0 + dx)}" y2="${round(axisY + dy)}" stroke="${color}" stroke-width="${HATCH_WIDTH}" stroke-linecap="butt"/>`,
      );
    }
    x0 += HATCH_GAP;
  }
  return lines.join("");
}

function renderArcPath(
  x1: number,
  x2: number,
  axisY: number,
  above: boolean,
  color: string,
  strokeWidth: number,
  plotLeft: number,
  plotRight: number,
  part: BuiltSetPart,
): string {
  const sign = above ? -1 : 1;
  const topY = axisY + sign * ARC_HEIGHT;
  const leftFinite = Number.isFinite(part.left);
  const rightFinite = Number.isFinite(part.right);
  let d = "";

  if (leftFinite && rightFinite) {
    d = `M ${round(x1)} ${round(axisY)} L ${round(x1)} ${round(topY)} L ${round(x2)} ${round(topY)} L ${round(x2)} ${round(axisY)}`;
  } else if (leftFinite && !rightFinite) {
    d = `M ${round(x1)} ${round(axisY)} L ${round(x1)} ${round(topY)} L ${round(plotRight)} ${round(topY)}`;
  } else if (!leftFinite && rightFinite) {
    d = `M ${round(plotLeft)} ${round(topY)} L ${round(x2)} ${round(topY)} L ${round(x2)} ${round(axisY)}`;
  } else {
    d = `M ${round(plotLeft)} ${round(topY)} L ${round(plotRight)} ${round(topY)}`;
  }

  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linejoin="miter" stroke-linecap="butt"/>`;
}

function renderSetPart(
  part: BuiltSetPart,
  set: SceneSet,
  geom: LineGeometry,
  row: LineRowGeometry,
  graphWidth: number,
): string {
  if (!set.built || !set.style.visible) return "";
  const vis = clipInterval(part, geom.axisMin, geom.axisMax);
  if (!vis) return "";
  const x1 = geom.sx(vis.left);
  const x2 = geom.sx(vis.right);
  const color = set.style.color;
  const above = set.style.position === "above";

  switch (set.style.display) {
    case "hatchRight":
      return `<g clip-path="url(#row-${row.rowIndex})">${renderHatch(x1, x2, row.axisY, above, true, color)}</g>`;
    case "hatchLeft":
      return `<g clip-path="url(#row-${row.rowIndex})">${renderHatch(x1, x2, row.axisY, above, false, color)}</g>`;
    case "arc":
      return renderArcPath(x1, x2, row.axisY, above, color, graphWidth, row.left, row.right, part);
    case "thickSegment": {
      const offset = above ? -5 : 5;
      return `<line x1="${round(x1)}" y1="${round(row.axisY + offset)}" x2="${round(x2)}" y2="${round(row.axisY + offset)}" stroke="${color}" stroke-width="5" stroke-linecap="butt"/>`;
    }
    default:
      return "";
  }
}

function renderPerpendiculars(
  points: SceneLinePoint[],
  geom: LineGeometry,
  canvasHeight: number,
  color: string,
): string {
  const lines: string[] = [];
  for (const point of points) {
    if (!point.style.visible || !point.style.perpendicular || !point.built) continue;
    const x = geom.sx(point.built.x);
    lines.push(
      `<line x1="${round(x)}" y1="0" x2="${round(x)}" y2="${round(canvasHeight)}" stroke="${color}" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.55"/>`,
    );
  }
  return lines.join("");
}

export function renderLineSvg(scene: PlotScene): string | null {
  const line = scene.line;
  const geom = resolveLineGeometry(scene);
  if (!line || !geom) return null;

  const a = scene.appearance;
  const parts: string[] = [];
  const majors = majorTickValues(geom.axisMin, geom.axisMax, geom.majorStep);
  const majorLabelValues = majorLabels(line.ticks, majors, geom.axisMin, geom.majorStep);
  const divisions = axisNumber(line.ticks.minorDivisions) ?? 5;
  const minors = line.ticks.minorEnabled
    ? minorTickValues(geom.axisMin, geom.axisMax, geom.majorStep, divisions)
    : [];
  const minorLabelValues = line.ticks.minorEnabled ? minorLabels(line.ticks, minors, geom.majorStep) : [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${geom.canvasWidth}" height="${geom.canvasHeight}" viewBox="0 0 ${geom.canvasWidth} ${geom.canvasHeight}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="#FFFFFF"/>`);

  for (const row of geom.rows) {
    parts.push(
      `<clipPath id="row-${row.rowIndex}"><rect x="${round(row.left)}" y="${round(row.top)}" width="${round(row.right - row.left)}" height="${round(row.bottom - row.top)}"/></clipPath>`,
    );
  }

  parts.push(
    renderPerpendiculars(line.points, geom, geom.canvasHeight, a.projectionColor),
  );

  for (const set of line.sets) {
    if (!set.built) continue;
    const row = geom.rows[set.axisRow] ?? geom.rows[0];
    for (const part of set.built.parts) {
      parts.push(renderSetPart(part, set, geom, row, a.graphWidth));
    }
  }

  const font = a.labelFontFamily;
  const axisStyle = `stroke="${a.axisColor}" stroke-width="${a.axisWidth}" stroke-linecap="round"`;
  const tickStyle = `stroke="${a.axisColor}" stroke-width="${a.tickWidth}" stroke-linecap="round"`;
  const arrow = a.arrowSize;
  const arrowHalf = arrow * 0.225;

  const unit = line.axis.unit.trim();
  const axisLabel = unit
    ? `${line.axis.name.trim() || "x"}, ${unit}`
    : line.axis.name.trim() || "x";

  for (const row of geom.rows) {
    const xStart = geom.sx(geom.contentMin);
    const xArrowBase = geom.sx(geom.contentMax);
    const xArrowTip = xArrowBase + arrow;
    parts.push(
      `<line x1="${round(xStart)}" y1="${round(row.axisY)}" x2="${round(xArrowBase)}" y2="${round(row.axisY)}" ${axisStyle}/>`,
      `<polygon points="${round(xArrowTip)},${round(row.axisY)} ${round(xArrowBase)},${round(row.axisY - arrowHalf)} ${round(xArrowBase)},${round(row.axisY + arrowHalf)}" fill="${a.axisColor}"/>`,
    );

    if (line.ticks.majorVisible) {
      for (const value of majors) {
        const x = geom.sx(value);
        parts.push(
          `<line x1="${round(x)}" y1="${round(row.axisY - a.tickSize)}" x2="${round(x)}" y2="${round(row.axisY + a.tickSize)}" ${tickStyle}/>`,
        );
      }
    }

    if (line.ticks.minorEnabled) {
      const minorSize = a.tickSize * 0.6;
      const minorWidth = a.tickWidth * 0.6;
      const minorStyle = `stroke="${a.axisColor}" stroke-width="${minorWidth}" stroke-linecap="round"`;
      for (const value of minors) {
        const x = geom.sx(value);
        parts.push(
          `<line x1="${round(x)}" y1="${round(row.axisY - minorSize)}" x2="${round(x)}" y2="${round(row.axisY + minorSize)}" ${minorStyle}/>`,
        );
      }
    }

    const tickLabelY = row.axisY + a.tickSize + a.labelFontSize + 2;
    for (const value of majorLabelValues) {
      const x = geom.sx(value);
      const text = displayNumber(value, "number");
      parts.push(renderSvgTextLabel(x, tickLabelY, "middle", text, a.labelFontSize, a.labelColor, font));
    }

    const minorFont = a.labelFontSize * 0.6;
    for (const value of minorLabelValues) {
      const x = geom.sx(value);
      const text = displayNumber(value, "number");
      parts.push(renderSvgTextLabel(x, tickLabelY, "middle", text, minorFont, a.labelColor, font));
    }

    const nameWidth = axisLabel.length * a.labelFontSize * 0.55;
    const nameX = Math.min(geom.canvasWidth - LINE_PADDING - 4, xArrowTip - 8);
    const safeNameX = Math.max(nameX - nameWidth, xStart + 20);
    const axisNameY = row.axisY + a.tickSize + a.labelFontSize + 6;
    parts.push(
      renderSvgTextLabel(safeNameX, axisNameY, "end", axisLabel, a.labelFontSize, a.labelColor, font, true),
    );
  }

  for (const point of line.points) {
    if (!point.style.visible || !point.built) continue;
    const row = geom.rows[point.axisRow] ?? geom.rows[0];
    const px = geom.sx(point.built.x);
    const py = row.axisY;
    const r = a.pointRadius;
    if (point.style.open) {
      parts.push(
        `<circle cx="${round(px)}" cy="${round(py)}" r="${round(r)}" fill="#FFFFFF" stroke="${point.style.color}" stroke-width="2.5"/>`,
      );
    } else {
      parts.push(`<circle cx="${round(px)}" cy="${round(py)}" r="${round(r)}" fill="${point.style.color}"/>`);
    }

    const labelColor = point.style.labelColor === "axis" ? a.labelColor : point.style.color;
    const coordColor = point.style.coordColor === "axis" ? a.labelColor : point.style.color;
    const nameFontSize = a.pointLabelFontSize;
    const coordFontSize = a.labelFontSize;
    const name =
      point.style.showLabel && point.style.label.trim() ? point.style.label.trim() : "";
    const coord = point.style.showCoords ? point.built.displayX : "";
    const coordLatex = point.built.latex;

    const labelYAbove = py - 10 - nameFontSize * 0.25;
    const labelYBelow = py + Math.max(nameFontSize, coordFontSize) + 12;

    if (name && coord && point.style.labelSide === point.style.coordSide && !labelNeedsLatex(coord)) {
      const y = point.style.labelSide === "above" ? labelYAbove : labelYBelow;
      parts.push(
        renderSvgTextLabel(
          px,
          y,
          "middle",
          `${name} (${coord})`,
          nameFontSize,
          labelColor,
          font,
          true,
        ),
      );
    } else {
      if (name) {
        const y = point.style.labelSide === "above" ? labelYAbove : labelYBelow;
        parts.push(
          renderSvgTextLabel(px, y, "middle", name, nameFontSize, labelColor, font, true),
        );
      }
      if (coord) {
        const y = point.style.coordSide === "above" ? labelYAbove : labelYBelow;
        parts.push(
          renderCoordinateLabel(px, y, coord, coordLatex, coordFontSize, coordColor, font),
        );
      }
    }
  }

  parts.push("</svg>");
  return parts.join("");
}

export function lineStepWarning(min: number, max: number, step: number): string | null {
  const span = max - min;
  if (step <= 0) return "Шаг больших засечек должен быть положительным.";
  const remainder = Math.abs((span / step) - Math.round(span / step));
  if (remainder > 1e-6 && remainder < 1 - 1e-6) {
    return `Расстояние ${displayNumber(max, "number")} − ${displayNumber(min, "number")} не делится на шаг ${displayNumber(step, "number")} без остатка.`;
  }
  return null;
}

export { valueOnMajorTick };
