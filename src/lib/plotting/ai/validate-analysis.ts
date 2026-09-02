import type { PlotAnalysisResult, PlotSceneType } from "./types";

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Поле «${field}» должно быть строкой`);
  return value;
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Поле «${field}» должно быть объектом`);
  }
  return value as Record<string, unknown>;
}

function parseSceneType(value: unknown): PlotSceneType {
  if (value === "plane" || value === "line") return value;
  throw new Error('Поле sceneType должно быть "plane" или "line"');
}

export function validatePlotAnalysisJson(value: unknown): PlotAnalysisResult {
  const root = asObject(value, "корень");
  const canDraw = Boolean(root.canDraw);
  const analysisText = asString(root.analysisText ?? root.analysis ?? "", "analysisText");

  if (!canDraw) {
    return {
      canDraw: false,
      analysisText: analysisText || "Построить изображение средствами инструмента нельзя.",
      stageData: {},
    };
  }

  const sceneType = parseSceneType(root.sceneType);
  const stageData = asObject(root.stageData ?? {}, "stageData");

  return { canDraw: true, sceneType, analysisText, stageData };
}
