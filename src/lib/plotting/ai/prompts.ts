/** Сборка промптов режима ИИ-рисования из отдельных файлов. */
import sharedSourceRules from "@/data/prompts/plotting/shared-source-rules.txt?raw";
import analyzeDraw from "@/data/prompts/plotting/analyze-draw.txt?raw";
import analyzeReproduce from "@/data/prompts/plotting/analyze-reproduce.txt?raw";
import analyzeAnalog from "@/data/prompts/plotting/analyze-analog.txt?raw";
import generateScene from "@/data/prompts/plotting/generate-scene.txt?raw";
import generateAnalog from "@/data/prompts/plotting/generate-analog.txt?raw";
import schemaPlane from "@/data/prompts/plotting/schema-plane.txt?raw";
import schemaLine from "@/data/prompts/plotting/schema-line.txt?raw";
import type { PlotAiScenario, PlotAnalysisResult, PlotSceneType } from "./types";

function injectShared(template: string, sourceText: string): string {
  const shared = sharedSourceRules.replaceAll("{{SOURCE_TEXT}}", sourceText || "(материал не передан)");
  return template.replaceAll("{{SHARED_SOURCE_RULES}}", shared);
}

export function buildAnalyzePrompt(opts: {
  scenario: PlotAiScenario;
  sourceText: string;
}): string {
  const { scenario, sourceText } = opts;
  let template: string;
  switch (scenario) {
    case "draw":
      template = analyzeDraw;
      break;
    case "reproduce":
      template = analyzeReproduce;
      break;
    case "analog":
      template = analyzeAnalog;
      break;
  }
  return injectShared(template, sourceText);
}

export function buildGeneratePrompt(opts: {
  scenario: PlotAiScenario;
  sourceText: string;
  analysis: PlotAnalysisResult;
  userRefinements: string;
  sceneType: PlotSceneType;
}): string {
  const { scenario, sourceText, analysis, userRefinements, sceneType } = opts;
  const schema = sceneType === "line" ? schemaLine : schemaPlane;
  const space = sceneType === "line" ? "line" : "plane";
  const analysisJson = JSON.stringify(analysis, null, 2);
  const refinements = userRefinements.trim() || "(нет — используй только анализ)";

  const template = scenario === "analog" ? generateAnalog : generateScene;
  return injectShared(template, sourceText)
    .replaceAll("{{ANALYSIS_JSON}}", analysisJson)
    .replaceAll("{{USER_REFINEMENTS}}", refinements)
    .replaceAll("{{SCENE_SCHEMA}}", schema)
    .replaceAll("{{SCENE_TYPE_SPACE}}", space);
}

export function buildGenerateRetrySuffix(validationErrors: string[]): string {
  return `

ПРЕДЫДУЩИЙ ОТВЕТ СОДЕРЖАЛ НЕКОРРЕКТНЫЙ JSON-СЦЕНЫ.
Ошибки проверки:
${validationErrors.map((e) => `- ${e}`).join("\n")}

Верни исправленный JSON, полностью соответствующий схеме и пригодный для рендерера. Только JSON, без пояснений.`;
}

export function analysisSchemaHint(): string {
  return `JSON с полями: canDraw (boolean), sceneType ("plane"|"line" если canDraw), analysisText (string), stageData (object).`;
}

export function generateSchemaHint(scenario: PlotAiScenario): string {
  return scenario === "analog"
    ? `{ "newTaskText": string, "scene": PlotScene }`
    : `{ "scene": PlotScene }`;
}
