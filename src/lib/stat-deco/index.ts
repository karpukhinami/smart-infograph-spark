export { STAT_DECO_STYLE_ID, validateStatDecoJson } from "./validate";
export { renderStatDecoJson, statDecoForBrief, statDecoTableMarkdown, CHART_TYPE_LABELS } from "./render";
export { renderStatDecoChartPng } from "./chart-png";
export { buildStatDecoOption, type StatDecoOptionResult } from "./echarts-option";
export { statDecoTheme, resolveColors } from "./colors";
export {
  getStatDecoChartBase64,
  getStatDecoChartPng,
  setStatDecoChartPng,
} from "./chart-image";
