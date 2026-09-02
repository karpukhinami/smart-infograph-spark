/** Типы и контракты режима ИИ-рисования на странице Plotting. */

/** Что анализировать в сценарии «Нарисовать по заданию» — зарезервировано. */
export type PlotAiScenario = "draw" | "reproduce" | "analog";

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
