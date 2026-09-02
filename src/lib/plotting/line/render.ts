/**
 * SVG-рендерер числовой прямой.
 */
import { displayNumber, evaluateNumber } from "../math-expr";
import type { PlotAppearance, PlotScene } from "../types";
import { majorTickValues, parseSemicolonList, valueOnMajorTick } from "./intervals";
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
  const plotRight = LINE_CANVAS_WIDTH - pad;
  const rowCount = Math.max(1, line.axisRowCount);
  const canvasHeight =
    rowCount * LINE_ROW_HEIGHT + Math.max(0, rowCount - 1) * LINE_ROW_GAP + pad * 2;

  const sx = (value: number) =>
    plotLeft + ((value - contentMin) / (contentMax - contentMin)) * (plotRight - plotLeft);

  const rows: LineRowGeometry[] = [];
  for (let i = 0; i < rowCount; i++) {
    const top = pad + i * (LINE_ROW_HEIGHT + LINE_ROW_GAP);
    const bottom = top + LINE_ROW_HEIGHT;
    const axisY = top + LINE_ROW_HEIGHT * 0.62;
    rows.push({ rowIndex: i, axisY, left: plotLeft, right: plotRight, top, bottom });
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

function escapeText(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

function renderHatch(
  x1: number,
  x2: number,
  axisY: number,
  above: boolean,
  direction: "right" | "left",
  color: string,
): string {
  const H = 20;
  const GAP = 11;
  const W = 2;
  const angle = 63.435 * (Math.PI / 180);
  const dx = Math.cos(angle) * H;
  const dy = Math.sin(angle) * H * (above ? -1 : 1) * (direction === "right" ? 1 : -1);
  const baseY = above ? axisY - 8 : axisY + 8;
  const lines: string[] = [];
  const width = x2 - x1;
  if (width <= 0) return "";
  let pos = 0;
  while (pos <= width + GAP) {
    const startX = x1 + pos;
    const endX = startX + dx;
    const startY = baseY;
    const endY = baseY + dy;
    if (endX >= x1 && startX <= x2) {
      const clipStartX = Math.max(startX, x1);
      const clipEndX = Math.min(endX, x2);
      if (clipEndX > clipStartX) {
        const t0 = (clipStartX - startX) / (endX - startX || 1);
        const t1 = (clipEndX - startX) / (endX - startX || 1);
        const y0 = startY + (endY - startY) * t0;
        const y1 = startY + (endY - startY) * t1;
        lines.push(
          `<line x1="${round(clipStartX)}" y1="${round(y0)}" x2="${round(clipEndX)}" y2="${round(y1)}" stroke="${color}" stroke-width="${W}" stroke-linecap="butt"/>`,
        );
      }
    }
    pos += GAP;
  }
  return lines.join("");
}

function renderSetPart(
  part: BuiltSetPart,
  set: SceneSet,
  geom: LineGeometry,
  row: LineRowGeometry,
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
      return `<g clip-path="url(#row-${row.rowIndex})">${renderHatch(x1, x2, row.axisY, above, "right", color)}</g>`;
    case "hatchLeft":
      return `<g clip-path="url(#row-${row.rowIndex})">${renderHatch(x1, x2, row.axisY, above, "left", color)}</g>`;
    case "arc": {
      const mid = (x1 + x2) / 2;
      const height = above ? -28 : 28;
      const cy = row.axisY + (above ? -36 : 36);
      return `<path d="M ${round(x1)} ${round(row.axisY)} Q ${round(mid)} ${round(cy)} ${round(x2)} ${round(row.axisY)}" fill="none" stroke="${color}" stroke-width="3"/>`;
    }
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
      parts.push(renderSetPart(part, set, geom, row));
    }
  }

  const axisStyle = `stroke="${a.axisColor}" stroke-width="${a.axisWidth}" stroke-linecap="round"`;
  const tickStyle = `stroke="${a.axisColor}" stroke-width="${a.tickWidth}" stroke-linecap="round"`;
  const labelStyle = `font-family="${escapeText(a.labelFontFamily)}" fill="${a.labelColor}"`;
  const arrow = a.arrowSize;
  const arrowHalf = arrow * 0.225;

  for (const row of geom.rows) {
    const xStart = geom.sx(geom.contentMin);
    const xEnd = geom.sx(geom.contentMax);
    parts.push(
      `<line x1="${round(xStart)}" y1="${round(row.axisY)}" x2="${round(xEnd - arrow)}" y2="${round(row.axisY)}" ${axisStyle}/>`,
      `<polygon points="${round(xEnd)},${round(row.axisY)} ${round(xEnd - arrow)},${round(row.axisY - arrowHalf)} ${round(xEnd - arrow)},${round(row.axisY + arrowHalf)}" fill="${a.axisColor}"/>`,
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

    for (const value of majorLabelValues) {
      const x = geom.sx(value);
      const text = displayNumber(value, "number");
      parts.push(
        `<text x="${round(x)}" y="${round(row.axisY + a.tickSize + a.labelFontSize + 2)}" text-anchor="middle" font-size="${a.labelFontSize}" ${labelStyle}>${escapeText(text)}</text>`,
      );
    }

    const minorFont = a.labelFontSize * 0.6;
    for (const value of minorLabelValues) {
      const x = geom.sx(value);
      const text = displayNumber(value, "number");
      parts.push(
        `<text x="${round(x)}" y="${round(row.axisY + a.tickSize + minorFont + 2)}" text-anchor="middle" font-size="${minorFont}" ${labelStyle}>${escapeText(text)}</text>`,
      );
    }
  }

  const unit = line.axis.unit.trim();
  const axisName = unit ? `${line.axis.name.trim() || "x"}, ${unit}` : line.axis.name.trim() || "x";
  const lastRow = geom.rows[geom.rows.length - 1];
  const nameWidth = axisName.length * a.labelFontSize * 0.55;
  const nameX = Math.min(geom.canvasWidth - LINE_PADDING - 4, geom.sx(geom.contentMax) - 8);
  const safeNameX = Math.max(nameX - nameWidth, geom.sx(geom.contentMin) + 20);
  parts.push(
    `<text x="${round(safeNameX)}" y="${round(lastRow.axisY - a.tickSize - 6)}" text-anchor="end" font-size="${a.labelFontSize}" ${labelStyle}>${escapeText(axisName)}</text>`,
  );

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
    const name = point.style.label.trim();
    const coord = point.style.showCoords ? point.built.displayX : "";

    if (name && coord && point.style.labelSide === point.style.coordSide) {
      parts.push(
        `<text x="${round(px)}" y="${round(point.style.labelSide === "above" ? py - 14 : py + a.labelFontSize + 14)}" text-anchor="middle" font-size="${a.labelFontSize}" ${labelStyle}>` +
          `<tspan fill="${labelColor}" font-style="italic">${escapeText(name)}</tspan>` +
          `<tspan fill="${coordColor}"> (${escapeText(coord)})</tspan></text>`,
      );
    } else {
      if (name) {
        const y = point.style.labelSide === "above" ? py - 14 : py + a.labelFontSize + 14;
        parts.push(
          `<text x="${round(px)}" y="${round(y)}" text-anchor="middle" font-size="${a.labelFontSize}" fill="${labelColor}" font-style="italic">${escapeText(name)}</text>`,
        );
      }
      if (coord) {
        const y = point.style.coordSide === "above" ? py - 14 : py + a.labelFontSize + 14;
        parts.push(
          `<text x="${round(px)}" y="${round(y)}" text-anchor="middle" font-size="${a.labelFontSize}" fill="${coordColor}">${escapeText(coord)}</text>`,
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
