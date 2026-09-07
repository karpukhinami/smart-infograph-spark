/** Общие константы и утилиты без зависимостей от scene/build/render (избегаем циклических импортов). */
import type { PlotAppearance } from "./types";

/** Основные шесть цветов чертежей (номер colorGroup = позиция в списке). */
export const PLOT_PALETTE = [
  "#29A2E5", // blue 7
  "#FF9935", // orange 7
  "#FF3C8A", // pink 7
  "#9050C7", // violet 7
  "#5DBB3B", // green 9
  "#31C2A7", // caribbean 9
];

/** Полная фирменная палитра: раскрывается по «плюсику» в выборе цвета. */
export const PLOT_PALETTE_GROUPS: { name: string; colors: string[] }[] = [
  { name: "Violet", colors: ["#6E25B9", "#8239CD", "#9050C7", "#A464DB", "#B878EF"] },
  { name: "Liliac", colors: ["#6366F1"] },
  { name: "Blue", colors: ["#1164C0", "#0087CD", "#2185F7", "#29A2E5"] },
  { name: "Caribbean", colors: ["#0BAC91", "#31C2A7", "#15D6A6", "#41EBB9"] },
  { name: "Green", colors: ["#21A038", "#5DBB3B", "#88C92D", "#94D826"] },
  { name: "Orange", colors: ["#FF733C", "#FF9935"] },
  { name: "Pink", colors: ["#CD1E6C", "#E13280", "#FF3C8A"] },
];

export const DEFAULT_APPEARANCE: PlotAppearance = {
  width: 720,
  height: 720,
  equalScale: false,
  padding: 16,

  axisWidth: 3,
  axisColor: "#1A2236",
  arrowSize: 24,
  gridWidth: 1,
  gridColor: "#CAD1E0",
  frame: true,
  frameWidth: 2,
  frameColor: "#CAD1E0",
  tickWidth: 2,
  tickSize: 6,

  labelFontFamily: "SB Serif Text, KaTeX_Main, ui-serif, serif",
  labelFontSize: 22,
  labelColor: "#1A2236",
  graphWidth: 3,
  pointRadius: 6,
  pointLabelFontSize: 32,
  pointLabelFontFamily: "SB Serif Text, KaTeX_Main, ui-serif, serif",
  projectionWidth: 1.2,
  projectionColor: "#8A93A6",
};

let counter = 0;

export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
