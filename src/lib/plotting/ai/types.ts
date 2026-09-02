/** Типы и контракты режима ИИ-рисования на странице Plotting. */

export type PlotAiScenario = "draw" | "reproduce" | "analog";

/** Что анализировать в сценарии «Нарисовать по…». */
export type DrawSourceMode = "condition" | "solution" | "answer";

export type PlotSceneType = "plane" | "line";

export interface PlotAnalysisResult {
  canDraw: boolean;
  sceneType?: PlotSceneType;
  /** Markdown + LaTeX для пользователя. */
  analysisText: string;
  /** Структурированные данные для второго этапа. */
  stageData: Record<string, unknown>;
}

export interface PlotGenerateSceneResult {
  scene: unknown;
}

export interface PlotGenerateAnalogResult {
  newTaskText: string;
  scene: unknown;
}

export type PlotGenerateResult = PlotGenerateSceneResult | PlotGenerateAnalogResult;

export interface PlotSceneValidation {
  valid: boolean;
  errors: string[];
}

export const DRAW_SOURCE_MODE_LABELS: Record<DrawSourceMode, string> = {
  condition: "условию",
  solution: "решению",
  answer: "ответу",
};
